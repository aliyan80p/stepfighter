import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFromBytes, decryptImdMedia } from "@/lib/imd-media-crypto";

const PLAIN_BUCKET = "qbank-media-plain";
const QBANK_ID = 3;
const QBANK_SLUG = "step3";

function stripPrefix(name: string): string {
  return name.replace(/^(highresdefault_|hqdefault_|mqdefault_|sddefault_|default_)/i, "");
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

async function alreadyCached(name: string, supaUrl: string, srk: string): Promise<boolean> {
  const path = `${QBANK_SLUG}/${name}`;
  const res = await fetch(
    `${supaUrl}/storage/v1/object/info/${PLAIN_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    { headers: { Authorization: `Bearer ${srk}`, apikey: srk } },
  );
  return res.ok;
}

async function processOne(
  row: { name: string; drive_file_id: string },
  supaUrl: string, srk: string, lovableKey: string, driveKey: string,
): Promise<"cached" | "done" | "failed"> {
  const { name, drive_file_id } = row;
  if (await alreadyCached(name, supaUrl, srk)) return "cached";
  const dl = await fetch(
    `https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${drive_file_id}?alt=media`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey } },
  );
  if (!dl.ok) return "failed";
  const encrypted = Buffer.from(await dl.arrayBuffer());
  const data = decryptImdMedia(encrypted, [name, stripPrefix(name)]);
  const type = contentTypeFromBytes(data, contentTypeFor(name));
  const up = await fetch(
    `${supaUrl}/storage/v1/object/${PLAIN_BUCKET}/${(`${QBANK_SLUG}/${name}`).split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${srk}`, apikey: srk,
        "Content-Type": type, "x-upsert": "true",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: data as unknown as BodyInit,
    },
  );
  return up.ok ? "done" : "failed";
}

export const Route = createFileRoute("/api/public/warm-step3")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get("offset") ?? "0");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 80);
        const concurrency = Math.min(Number(url.searchParams.get("concurrency") ?? "8"), 16);
        const supaUrl = process.env.SUPABASE_URL;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
        if (!supaUrl || !srk || !lovableKey || !driveKey) return new Response("Missing env", { status: 500 });
        const listUrl = `${supaUrl}/rest/v1/qbank_media?select=name,drive_file_id&qbank_id=eq.${QBANK_ID}&order=name.asc&limit=${limit}&offset=${offset}`;
        const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${srk}`, apikey: srk } });
        if (!listRes.ok) return new Response(`list failed ${listRes.status}`, { status: 500 });
        const rows = (await listRes.json()) as Array<{ name: string; drive_file_id: string }>;
        const counts = { cached: 0, done: 0, failed: 0 };
        const failedNames: string[] = [];
        let cursor = 0;
        async function worker() {
          while (cursor < rows.length) {
            const idx = cursor++;
            const row = rows[idx];
            try {
              const r = await processOne(row, supaUrl!, srk!, lovableKey!, driveKey!);
              counts[r]++;
              if (r === "failed") failedNames.push(row.name);
            } catch { counts.failed++; failedNames.push(row.name); }
          }
        }
        await Promise.all(Array.from({ length: concurrency }, worker));
        return Response.json({
          processed: rows.length, nextOffset: offset + rows.length,
          hasMore: rows.length === limit, counts, failed: failedNames.slice(0, 20),
        });
      },
    },
  },
});
