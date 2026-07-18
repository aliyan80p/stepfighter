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
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);
        const concurrency = Math.min(Number(url.searchParams.get("concurrency") ?? "8"), 16);

        // Pull missing rows: qbank_media rows whose plain-bucket object is absent.
        // Use PostgREST RPC via a raw SQL through storage? Simpler: fetch a page of
        // qbank_media, check storage presence per-name.
        const qFilter = qbankId ? `&qbank_id=eq.${qbankId}` : "";
        const listRes = await fetch(
          `${supaUrl}/rest/v1/qbank_media?select=qbank_id,name,drive_file_id${qFilter}&limit=${limit * 6}`,
          { headers: { Authorization: `Bearer ${srk}`, apikey: srk, "Range-Unit": "items", Prefer: "count=none" } },
        );
        if (!listRes.ok) return new Response(`List failed: ${await listRes.text()}`, { status: 500 });
        const candidates = (await listRes.json()) as Array<{
          qbank_id: number; name: string; drive_file_id: string | null;
        }>;

        // Filter to missing by HEAD-checking storage (cheap)
        const missing: typeof candidates = [];
        await Promise.all(candidates.map(async (row) => {
          if (missing.length >= limit) return;
          const path = `${SLUGS[row.qbank_id] ?? ""}${row.name}`;
          const head = await fetch(
            `${supaUrl}/storage/v1/object/info/${PLAIN_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
            { headers: { Authorization: `Bearer ${srk}`, apikey: srk } },
          );
          if (!head.ok && missing.length < limit) missing.push(row);
        }));

        // Process with limited concurrency
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
            scanned: candidates.length, missing_found: missing.length,
            processed: results.length, uploaded: ok,
            errors: results.filter((r) => !r.ok).slice(0, 10),
          }, null, 2),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
