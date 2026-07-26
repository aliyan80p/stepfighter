import { createFileRoute } from "@tanstack/react-router";

/**
 * Automated backup endpoint.
 *
 * Dumps database tables to gzipped JSON and stores them BOTH in the private
 * `backups` storage bucket and in a Google Drive folder ("StepFighter Backups"),
 * under a dated folder (YYYY-MM-DD). Keeps the newest RETENTION snapshots.
 *
 * Called nightly by pg_cron. Auth: `apikey` header must match the project
 * publishable key.
 */

const BUCKET = "backups";
const RETENTION = 14;
const PAGE = 1000;
const FILE_ROWS = 25000;
const DRIVE_ROOT_NAME = "StepFighter Backups";

const GROUPS: Record<string, string[]> = {
  users: [
    "profiles", "user_roles", "user_entitlements", "attempts", "tests",
    "bookmarks", "flashcards", "flashcard_decks", "flashcard_reviews",
    "question_notes", "feedback", "qbank_resets", "internal_config",
  ],
  questions: ["questions", "answers"],
  content: ["qbank_media", "refs", "library_docs", "library_toc", "subjects", "systems", "qbanks"],
  // Auth schema (login accounts, password hashes, linked identities, 2FA factors).
  // Read through a service-role-only SECURITY DEFINER function.
  auth: ["users", "identities", "mfa_factors"],
};

const AUTH_GROUP = "auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}

async function fetchPage(
  supaUrl: string, srk: string, table: string, offset: number,
): Promise<unknown[]> {
  const res = await fetch(
    `${supaUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=${PAGE}`,
    { headers: { apikey: srk, Authorization: `Bearer ${srk}`, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`read ${table} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as unknown[];
}

async function putObject(
  supaUrl: string, srk: string, path: string, body: ArrayBuffer,
): Promise<void> {
  const res = await fetch(`${supaUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: srk,
      Authorization: `Bearer ${srk}`,
      "Content-Type": "application/gzip",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) throw new Error(`upload ${path} failed: ${res.status} ${await res.text()}`);
}

async function listStorage(supaUrl: string, srk: string, prefix: string) {
  const res = await fetch(`${supaUrl}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) return [] as Array<{ name: string; id: string | null }>;
  return (await res.json()) as Array<{ name: string; id: string | null }>;
}

async function pruneStorage(supaUrl: string, srk: string) {
  const folders = (await listStorage(supaUrl, srk, ""))
    .filter((e) => e.id === null && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  const stale = folders.slice(0, Math.max(0, folders.length - RETENTION));
  for (const folder of stale) {
    const files = await listStorage(supaUrl, srk, `${folder}/`);
    const prefixes = files.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (!prefixes.length) continue;
    await fetch(`${supaUrl}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes }),
    });
  }
  return stale;
}

/* ---------------- Google Drive ---------------- */

function driveHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) return null;
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey };
}

const DRIVE = "https://connector-gateway.lovable.dev/google_drive";

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
  headers: Record<string, string>, parent: string, name: string, gzBody: ArrayBuffer,
) {
  const boundary = "sfbackup" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: [parent] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(gzBody);
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
}

async function drivePrune(headers: Record<string, string>, rootId: string) {
  const q = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `${DRIVE}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=200`,
    { headers },
  );
  if (!res.ok) return [];
  const files = ((await res.json()) as { files?: Array<{ id: string; name: string }> }).files ?? [];
  const dated = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const stale = dated.slice(0, Math.max(0, dated.length - RETENTION));
  for (const f of stale) {
    await fetch(`${DRIVE}/drive/v3/files/${f.id}`, { method: "DELETE", headers });
  }
  return stale.map((f) => f.name);
}

/* ---------------- Route ---------------- */

export const Route = createFileRoute("/api/public/hooks/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supaUrl = process.env.SUPABASE_URL;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supaUrl || !srk || !publishable) {
          return Response.json({ error: "not configured" }, { status: 500 });
        }
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== publishable) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        let body: { group?: string; drive?: boolean } = {};
        try { body = (await request.json()) as typeof body; } catch { /* empty body ok */ }
        const group = body.group && GROUPS[body.group] ? body.group : "users";
        const tables = GROUPS[group];
        const wantDrive = body.drive !== false;
        const stamp = today();

        const headers = wantDrive ? driveHeaders() : null;
        let driveDay: string | null = null;
        if (headers) {
          const root = await driveFindOrCreateFolder(headers, DRIVE_ROOT_NAME);
          if (root) driveDay = await driveFindOrCreateFolder(headers, stamp, root);
        }

        const report: Record<string, number> = {};
        const errors: string[] = [];

        for (const table of tables) {
          let offset = 0;
          let part = 0;
          let total = 0;
          let buffer: unknown[] = [];
          const flush = async () => {
            if (!buffer.length && part > 0) return;
            part += 1;
            const name = `${table}.part${String(part).padStart(3, "0")}.json.gz`;
            const gz = await gzip(JSON.stringify(buffer));
            await putObject(supaUrl, srk, `${stamp}/${name}`, gz);
            if (headers && driveDay) await driveUpload(headers, driveDay, name, gz);
            buffer = [];
          };
          try {
            for (;;) {
              const rows = await fetchPage(supaUrl, srk, table, offset);
              total += rows.length;
              buffer.push(...rows);
              if (buffer.length >= FILE_ROWS) await flush();
              if (rows.length < PAGE) break;
              offset += PAGE;
            }
            await flush();
            report[table] = total;
          } catch (e) {
            errors.push(`${table}: ${(e as Error).message}`);

          }
        }

        const prunedStorage = await pruneStorage(supaUrl, srk);
        let prunedDrive: string[] = [];
        if (headers) {
          const root = await driveFindOrCreateFolder(headers, DRIVE_ROOT_NAME);
          if (root) prunedDrive = await drivePrune(headers, root);
        }

        return Response.json({
          ok: errors.length === 0,
          date: stamp,
          group,
          rows: report,
          drive: Boolean(driveDay),
          prunedStorage,
          prunedDrive,
          errors,
        });
      },
    },
  },
});
