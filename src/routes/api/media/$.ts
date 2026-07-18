import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const FOLDER_ID = "1qIsUWcZmoR7d1OybpW88FBkcA5llcRio";

// In-memory cache within a Worker instance
const idCache = new Map<string, string | null>();

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

async function findFileId(name: string, apiKey: string, lovableKey: string): Promise<string | null> {
  if (idCache.has(name)) return idCache.get(name)!;
  const candidates = Array.from(new Set([name, stripPrefix(name)]));
  const variants: string[] = [];
  for (const c of candidates) {
    variants.push(c);
    // Try swapping U<->L prefix in case DB references differ from Drive naming
    if (/^L\d/.test(c)) variants.push("U" + c.slice(1));
    else if (/^U\d/.test(c)) variants.push("L" + c.slice(1));
  }
  for (const v of Array.from(new Set(variants))) {
    const q = `name='${v.replace(/'/g, "\\'")}' and '${FOLDER_ID}' in parents and trashed=false`;
    const url = `${GATEWAY}/files?fields=files(id,name)&pageSize=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": apiKey,
      },
    });
    if (!res.ok) continue;
    const j = (await res.json()) as { files?: { id: string; name: string }[] };
    const id = j.files?.[0]?.id;
    if (id) {
      idCache.set(name, id);
      return id;
    }
  }
  idCache.set(name, null);
  return null;
}

export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const raw = (params as any)._splat as string;
        const name = decodeURIComponent(raw.split("/").pop() ?? "");
        if (!name) return new Response("Bad request", { status: 400 });

        const lovableKey = process.env.LOVABLE_API_KEY;
        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        if (!lovableKey || !apiKey) {
          return new Response("Media service not configured", { status: 500 });
        }

        const fileId = await findFileId(name, apiKey, lovableKey);
        if (!fileId) return new Response("Not found", { status: 404 });

        const upstream = await fetch(`${GATEWAY}/files/${fileId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": apiKey,
            // Forward range for video seeking
            ...(request.headers.get("range") ? { Range: request.headers.get("range")! } : {}),
          },
        });

        if (!upstream.ok && upstream.status !== 206) {
          const body = await upstream.text();
          return new Response(`Upstream ${upstream.status}: ${body}`, { status: upstream.status });
        }

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") ?? contentTypeFor(name));
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        const range = upstream.headers.get("content-range");
        if (range) headers.set("Content-Range", range);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
