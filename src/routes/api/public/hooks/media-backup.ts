import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFromBytes, decryptImdMedia } from "@/lib/imd-media-crypto";

/**
 * Incremental media backup endpoint.
 *
 * Mirrors the binary contents of the `qbank-media-plain` storage bucket into a
 * Google Drive folder ("StepFighter Media Backup"), one Drive sub-folder per
 * bucket. Files already mirrored are tracked in `public.media_backup_log`, so
 * each run only uploads what is new or changed and the job is fully resumable.
 *
 * The legacy `qbank-media` bucket is intentionally NOT backed up: every one of
 * its objects already exists, decrypted and verified, under the same name in
 * `qbank-media-plain`. Mirroring it would only duplicate ~580MB in Drive. It is
 * kept in storage purely as a read fallback for the media route.
 *
 * Called on a schedule by pg_cron. Auth: `apikey` header must match the
 * project publishable key.
 */

const BUCKETS = ["qbank-media-plain"] as const;
const ENCRYPTED_BUCKET = "qbank-media";

const DRIVE_ROOT_NAME = "StepFighter Media Backup";
const DEFAULT_BATCH = 60;
const BYTE_BUDGET = 80 * 1024 * 1024; // ~80MB per invocation (Worker memory safe)
const CONCURRENCY = 6; // parallel download+upload workers per bucket




const DRIVE = "https://connector-gateway.lovable.dev/google_drive";

function driveHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) return null;
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey };
}

async function driveFindOrCreateFolder(
  headers: Record<string, string>, name: string, parent?: string,
): Promise<string | null> {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parent ? `'${parent}' in parents` : null,
  ].filter(Boolean).join(" and ");
  const found = await fetch(
    `${DRIVE}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers },
  );
  if (found.ok) {
    const j = (await found.json()) as { files?: Array<{ id: string }> };
    if (j.files?.length) return j.files[0].id;
  }
  const created = await fetch(`${DRIVE}/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parent ? { parents: [parent] } : {}),
    }),
  });
  if (!created.ok) return null;
  return ((await created.json()) as { id: string }).id;
}

async function driveUpload(
  headers: Record<string, string>,
  parent: string,
  name: string,
  contentType: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const boundary = "sfmedia" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: [parent] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(bytes);
  const payload = new Uint8Array(head.length + body.length + tail.length);
  payload.set(head, 0);
  payload.set(body, head.length);
  payload.set(tail, head.length + body.length);
  const res = await fetch(`${DRIVE}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: payload.buffer as ArrayBuffer,
  });
  if (!res.ok) throw new Error(`drive upload ${name} failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

/* ---------------- Supabase helpers ---------------- */

async function rpc<T>(supaUrl: string, srk: string, fn: string, args: unknown): Promise<T> {
  const res = await fetch(`${supaUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: srk,
      Authorization: `Bearer ${srk}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function downloadObject(
  supaUrl: string, srk: string, bucket: string, name: string,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const res = await fetch(
    `${supaUrl}/storage/v1/object/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}`,
    { headers: { apikey: srk, Authorization: `Bearer ${srk}` } },
  );
  if (!res.ok) throw new Error(`download ${bucket}/${name} failed: ${res.status}`);
  return {
    bytes: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

async function logUploaded(
  supaUrl: string, srk: string,
  rows: Array<{ bucket: string; name: string; size: number | null; drive_file_id: string }>,
) {
  if (!rows.length) return;
  const res = await fetch(`${supaUrl}/rest/v1/media_backup_log?on_conflict=bucket,name`, {
    method: "POST",
    headers: {
      apikey: srk,
      Authorization: `Bearer ${srk}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows.map((r) => ({ ...r, uploaded_at: new Date().toISOString() }))),
  });
  if (!res.ok) throw new Error(`log failed: ${res.status} ${await res.text()}`);
}

/**
 * One-time cleanup: removes already-mirrored copies of `qbank-media` that were
 * uploaded before decryption was added, so the next passes re-upload them plain.
 * Deletes the Drive file and the log row, in batches. Idempotent and resumable.
 */
async function redoEncrypted(
  supaUrl: string, srk: string, headers: Record<string, string>, limit: number,
): Promise<{ removed: number; remaining: number; errors: string[] }> {
  const errors: string[] = [];
  const listRes = await fetch(
    `${supaUrl}/rest/v1/media_backup_log?select=id,drive_file_id&bucket=eq.${ENCRYPTED_BUCKET}` +
    `&order=id&limit=${limit}`,
    { headers: { apikey: srk, Authorization: `Bearer ${srk}`, Prefer: "count=exact" } },
  );
  if (!listRes.ok) throw new Error(`redo list failed: ${listRes.status}`);
  const rows = (await listRes.json()) as Array<{ id: number; drive_file_id: string }>;
  const total = Number(listRes.headers.get("content-range")?.split("/")[1] ?? rows.length);

  const queue = rows.slice();
  const removedIds: number[] = [];
  const worker = async () => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      try {
        if (row.drive_file_id) {
          const del = await fetch(`${DRIVE}/drive/v3/files/${row.drive_file_id}`, {
            method: "DELETE", headers,
          });
          // 404 means it is already gone — treat as success.
          if (!del.ok && del.status !== 404) throw new Error(`drive delete ${del.status}`);
        }
        removedIds.push(row.id);
      } catch (e) {
        errors.push(`redo ${row.drive_file_id}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));

  if (removedIds.length) {
    const del = await fetch(
      `${supaUrl}/rest/v1/media_backup_log?id=in.(${removedIds.join(",")})`,
      { method: "DELETE", headers: { apikey: srk, Authorization: `Bearer ${srk}`, Prefer: "return=minimal" } },
    );
    if (!del.ok) throw new Error(`redo log delete failed: ${del.status}`);
  }
  return { removed: removedIds.length, remaining: Math.max(total - removedIds.length, 0), errors };
}

/* ---------------- Route ---------------- */


export const Route = createFileRoute("/api/public/hooks/media-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supaUrl = process.env.SUPABASE_URL;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supaUrl || !srk || !publishable) {
          return Response.json({ error: "not configured" }, { status: 500 });
        }
        if (request.headers.get("apikey") !== publishable) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        let body: {
          batch?: number; status?: boolean; redo?: boolean;
          shard?: number; shards?: number;
        } = {};
        try { body = (await request.json()) as typeof body; } catch { /* empty body ok */ }
        // Sharding lets several passes run in parallel without picking the same files.
        const shards = Math.min(Math.max(body.shards ?? 1, 1), 32);
        const shard = Math.min(Math.max(body.shard ?? 0, 0), shards - 1);

        const progress = await rpc<Array<{ bucket: string; total: number; backed_up: number }>>(
          supaUrl, srk, "media_backup_progress", {},
        );
        if (body.status) return Response.json({ ok: true, progress });

        const headers = driveHeaders();
        if (!headers) return Response.json({ error: "drive not connected" }, { status: 500 });
        const root = await driveFindOrCreateFolder(headers, DRIVE_ROOT_NAME);
        if (!root) return Response.json({ error: "drive root unavailable" }, { status: 502 });

        if (body.redo) {
          const result = await redoEncrypted(
            supaUrl, srk, headers, Math.min(Math.max(body.batch ?? 200, 1), 500),
          );
          return Response.json({ ok: result.errors.length === 0, redo: result });
        }


        const batch = Math.min(Math.max(body.batch ?? DEFAULT_BATCH, 1), 1000);
        const uploaded: Record<string, number> = {};
        const errors: string[] = [];
        let bytes = 0;
        let count = 0;

        for (const bucket of BUCKETS) {
          if (count >= batch || bytes >= BYTE_BUDGET) break;
          const folder = await driveFindOrCreateFolder(headers, bucket, root);
          if (!folder) { errors.push(`${bucket}: drive folder unavailable`); continue; }

          const want = batch - count;
          const listed = await rpc<Array<{ name: string; size: number | null }>>(
            supaUrl, srk, "list_media_objects",
            { _bucket: bucket, _limit: shards > 1 ? want * shards : want },
          );
          const pending = shards > 1
            ? listed.filter((_, i) => i % shards === shard).slice(0, want)
            : listed;

          const done: Array<{ bucket: string; name: string; size: number | null; drive_file_id: string }> = [];
          const queue = pending.slice();
          const worker = async () => {
            for (;;) {
              if (count >= batch || bytes >= BYTE_BUDGET) return;
              const obj = queue.shift();
              if (!obj) return;
              count += 1; // reserve a slot before the async work so workers don't overshoot
              try {
                const { bytes: buf, contentType } = await downloadObject(supaUrl, srk, bucket, obj.name);
                // Flatten the path so nested keys stay unique inside one Drive folder.
                const driveName = obj.name.replace(/\//g, "__");
                let payload: Uint8Array = new Uint8Array(buf);
                let type = contentType;
                if ((bucket as string) === ENCRYPTED_BUCKET) {
                  // Legacy AES media: key derives from the file name. Store plain
                  // bytes in Drive so the backup is directly viewable.
                  const leaf = obj.name.slice(obj.name.lastIndexOf("/") + 1);
                  const plain = decryptImdMedia(payload, [leaf]);
                  payload = new Uint8Array(plain);
                  type = contentTypeFromBytes(payload, contentType);
                }

                const id = await driveUpload(
                  headers, folder, driveName, type,
                  payload.buffer.slice(
                    payload.byteOffset, payload.byteOffset + payload.byteLength,
                  ) as ArrayBuffer,
                );
                done.push({ bucket, name: obj.name, size: obj.size, drive_file_id: id });
                bytes += payload.byteLength;
              } catch (e) {
                errors.push(`${bucket}/${obj.name}: ${(e as Error).message}`);
              }

            }
          };
          await Promise.all(
            Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
          );
          await logUploaded(supaUrl, srk, done);
          uploaded[bucket] = done.length;
        }


        const after = await rpc<Array<{ bucket: string; total: number; backed_up: number }>>(
          supaUrl, srk, "media_backup_progress", {},
        );

        return Response.json({
          ok: errors.length === 0,
          uploaded,
          bytes,
          progress: after,
          remaining: after.reduce((s, p) => s + (p.total - p.backed_up), 0),
          errors: errors.slice(0, 20),
        });
      },
    },
  },
});
