import { createFileRoute } from "@tanstack/react-router";

/**
 * Resumable Google Drive media-backup cleanup.
 *
 * Consolidates every `qbank-media-plain` folder into one canonical folder and
 * trashes duplicate copies (same file name). Idempotent: each call processes a
 * bounded batch, so it can be invoked repeatedly until `remaining` is 0.
 *
 * Auth: `apikey` header must match the project publishable key.
 */

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const MEDIA_ROOT_NAME = "StepFighter Media Backup";
const MEDIA_FOLDER_NAME = "qbank-media-plain";

type H = Record<string, string>;

function driveHeaders(): H | null {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) return null;
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey };
}

async function dj<T>(headers: H, url: string): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`drive ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

type File = { id: string; name: string; size?: string; parents?: string[] };

async function listAll(headers: H, q: string, fields = "id,name,size,parents", cap = 100000) {
  const out: File[] = [];
  let token: string | undefined;
  do {
    const url =
      `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${fields})` +
      `&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (token ? `&pageToken=${token}` : "");
    const page = await dj<{ files?: File[]; nextPageToken?: string }>(headers, url);
    out.push(...(page.files ?? []));
    token = page.nextPageToken;
  } while (token && out.length < cap);
  return out;
}

async function mediaFolders(headers: H): Promise<string[]> {
  const roots = await listAll(
    headers,
    `name='${MEDIA_ROOT_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    "id,name",
  );
  const folders: string[] = [];
  for (const r of roots) {
    const kids = await listAll(
      headers,
      `'${r.id}' in parents and name='${MEDIA_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      "id,name",
    );
    folders.push(...kids.map((k) => k.id));
  }
  return folders;
}

async function pooled<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          await fn(item);
        } catch {
          /* retried on a later call */
        }
      }
    }),
  );
}

export const Route = createFileRoute("/api/public/hooks/drive-dedup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireHookSecret } = await import("@/lib/hook-auth.server");
        const denied = await requireHookSecret(request);
        if (denied) return denied;

        const headers = driveHeaders();
        if (!headers) {
          return Response.json({ error: "not configured" }, { status: 500 });
        }


        let body: { batch?: number; concurrency?: number } = {};
        try { body = (await request.json()) as typeof body; } catch { /* optional */ }
        const batch = Math.min(Math.max(body.batch ?? 400, 1), 2000);
        const concurrency = Math.min(Math.max(body.concurrency ?? 8, 1), 16);

        const folders = await mediaFolders(headers);
        if (!folders.length) return Response.json({ error: "no media folders" }, { status: 404 });

        // Canonical folder = the one holding the most files.
        const counts = await Promise.all(
          folders.map(async (f) => ({ id: f, files: await listAll(headers, `'${f}' in parents and trashed=false`) })),
        );
        counts.sort((a, b) => b.files.length - a.files.length);
        const target = counts[0];
        const keep = new Map<string, File>();
        for (const f of target.files) keep.set(f.name, f);

        const others = counts.slice(1).flatMap((c) => c.files.map((f) => ({ ...f, from: c.id })));
        const remainingBefore = others.length;
        const work = others.slice(0, batch);

        let trashed = 0;
        let moved = 0;

        await pooled(work, concurrency, async (f) => {
          const existing = keep.get(f.name);
          if (existing && existing.id !== f.id) {
            const res = await fetch(`${DRIVE}/files/${f.id}?supportsAllDrives=true`, {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ trashed: true }),
            });
            if (res.ok) trashed++;
            return;
          }
          const res = await fetch(
            `${DRIVE}/files/${f.id}?addParents=${target.id}&removeParents=${f.from}&supportsAllDrives=true&fields=id`,
            { method: "PATCH", headers },
          );
          if (res.ok) {
            keep.set(f.name, f);
            moved++;
          }
        });

        // When everything is consolidated, remove the now-empty extra folders.
        const doneAll = remainingBefore <= work.length;
        let removedFolders = 0;
        if (doneAll) {
          for (const c of counts.slice(1)) {
            const left = await listAll(headers, `'${c.id}' in parents and trashed=false`, "id,name");
            if (left.length) continue;
            const res = await fetch(`${DRIVE}/files/${c.id}?supportsAllDrives=true`, {
              method: "PATCH",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ trashed: true }),
            });
            if (res.ok) removedFolders++;
          }
        }

        return Response.json({
          ok: true,
          targetFolder: target.id,
          targetFiles: keep.size,
          processed: work.length,
          trashed,
          moved,
          remaining: Math.max(0, remainingBefore - work.length),
          removedFolders,
        });
      },
    },
  },
});
