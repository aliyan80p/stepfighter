import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFromBytes, decryptImdMedia } from "@/lib/imd-media-crypto";

const PLAIN_BUCKET = "qbank-media-plain";
const ENC_BUCKET = "qbank-media";
const SLUGS: Record<number, string> = { 1: "", 2: "step1/", 3: "step3/" };

function stripPrefix(n: string) {
  return n.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/i, "");
}
function contentTypeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4",
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav",
  };
  return map[ext] ?? "application/octet-stream";
}

async function listAllStorageNames(prefix: string, supaUrl: string, srk: string): Promise<Set<string>> {
  const out = new Set<string>();
  const limit = 1000;
  let offset = 0;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${supaUrl}/storage/v1/object/list/${PLAIN_BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${srk}`, apikey: srk, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) break;
    const rows = (await res.json()) as Array<{ name: string }>;
    for (const r of rows) out.add(prefix + r.name);
    if (rows.length < limit) break;
    offset += limit;
  }
  return out;
}

async function fetchEncrypted(
  qbankId: number, name: string, driveFileId: string | null,
  supaUrl: string, srk: string,
): Promise<Buffer | null> {
  if (qbankId === 1) {
    const res = await fetch(
      `${supaUrl}/storage/v1/object/${ENC_BUCKET}/${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${srk}`, apikey: srk } },
    );
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  if (!driveFileId) return null;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) return null;
  const dl = await fetch(
    `https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${driveFileId}?alt=media`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey } },
  );
  if (!dl.ok) return null;
  return Buffer.from(await dl.arrayBuffer());
}

async function uploadPlain(path: string, data: Buffer, ct: string, supaUrl: string, srk: string) {
  const res = await fetch(
    `${supaUrl}/storage/v1/object/${PLAIN_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${srk}`, apikey: srk,
        "Content-Type": ct, "x-upsert": "true",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: data as any,
    },
  );
  return res.ok;
}

async function processOne(
  row: { qbank_id: number; name: string; drive_file_id: string | null },
  supaUrl: string, srk: string,
): Promise<{ name: string; ok: boolean; err?: string }> {
  try {
    const enc = await fetchEncrypted(row.qbank_id, row.name, row.drive_file_id, supaUrl, srk);
    if (!enc) return { name: row.name, ok: false, err: "no-source" };
    const data = decryptImdMedia(enc, [row.name, stripPrefix(row.name)]);
    const ct = contentTypeFromBytes(data, contentTypeFor(row.name));
    const path = `${SLUGS[row.qbank_id] ?? ""}${row.name}`;
    const ok = await uploadPlain(path, data, ct, supaUrl, srk);
    return { name: row.name, ok, err: ok ? undefined : "upload-failed" };
  } catch (e: any) {
    return { name: row.name, ok: false, err: String(e?.message ?? e).slice(0, 200) };
  }
}

export const Route = createFileRoute("/api/public/warm-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-warm-secret");
        if (!secret || secret !== process.env.WARM_MEDIA_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
        const supaUrl = process.env.SUPABASE_URL!;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const url = new URL(request.url);
        const qbankId = Number(url.searchParams.get("qbank_id") ?? "0");
        if (!qbankId || !(qbankId in SLUGS)) {
          return new Response("qbank_id required (1|2|3)", { status: 400 });
        }
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 200);
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const concurrency = Math.min(Number(url.searchParams.get("concurrency") ?? "8"), 24);
        const prefix = SLUGS[qbankId];

        // Load existing storage names for this qbank prefix
        const existing = await listAllStorageNames(prefix, supaUrl, srk);

        // Paginate qbank_media rows for this qbank, filter to missing
        const missing: Array<{ qbank_id: number; name: string; drive_file_id: string | null }> = [];
        let pgOffset = offset;
        const pageSize = 1000;
        let scanned = 0;
        while (missing.length < limit && scanned < 20000) {
          const listRes = await fetch(
            `${supaUrl}/rest/v1/qbank_media?select=qbank_id,name,drive_file_id&qbank_id=eq.${qbankId}&order=name&limit=${pageSize}&offset=${pgOffset}`,
            { headers: { Authorization: `Bearer ${srk}`, apikey: srk } },
          );
          if (!listRes.ok) return new Response(`List failed: ${await listRes.text()}`, { status: 500 });
          const rows = (await listRes.json()) as Array<{
            qbank_id: number; name: string; drive_file_id: string | null;
          }>;
          if (rows.length === 0) break;
          scanned += rows.length;
          for (const r of rows) {
            if (!existing.has(prefix + r.name)) {
              missing.push(r);
              if (missing.length >= limit) break;
            }
          }
          pgOffset += rows.length;
          if (rows.length < pageSize) break;
        }

        // Process
        const queue = missing.slice(0, limit);
        const results: Array<{ name: string; ok: boolean; err?: string }> = [];
        let idx = 0;
        await Promise.all(
          Array.from({ length: concurrency }, async () => {
            while (idx < queue.length) {
              const row = queue[idx++];
              results.push(await processOne(row, supaUrl, srk));
            }
          }),
        );
        const ok = results.filter((r) => r.ok).length;
        return new Response(
          JSON.stringify({
            existing_count: existing.size, scanned, missing_selected: queue.length,
            processed: results.length, uploaded: ok,
            errors: results.filter((r) => !r.ok).slice(0, 10),
          }, null, 2),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
