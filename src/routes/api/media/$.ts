import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "qbank-media";

// Cache which name variant exists per Worker instance
const nameCache = new Map<string, string | null>();

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

function candidateNames(name: string): string[] {
  const set = new Set<string>();
  const bases = [name, stripPrefix(name)];
  for (const b of bases) {
    set.add(b);
    if (/^L\d/.test(b)) set.add("U" + b.slice(1));
    else if (/^U\d/.test(b)) set.add("L" + b.slice(1));
  }
  return Array.from(set);
}

async function resolveObject(
  name: string,
  supaUrl: string,
  srk: string,
  range: string | null,
): Promise<Response | null> {
  const cached = nameCache.get(name);
  const tryNames = cached === undefined ? candidateNames(name) : cached ? [cached] : [];
  for (const n of tryNames) {
    const url = `${supaUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(n)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${srk}`,
        apikey: srk,
        ...(range ? { Range: range } : {}),
      },
    });
    if (res.ok || res.status === 206) {
      nameCache.set(name, n);
      return res;
    }
  }
  if (cached === undefined) nameCache.set(name, null);
  return null;
}

export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const raw = (params as any)._splat as string;
        const name = decodeURIComponent(raw.split("/").pop() ?? "");
        if (!name) return new Response("Bad request", { status: 400 });

        const supaUrl = process.env.SUPABASE_URL;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supaUrl || !srk) {
          return new Response("Media service not configured", { status: 500 });
        }

        const range = request.headers.get("range");
        const upstream = await resolveObject(name, supaUrl, srk, range);
        if (!upstream) return new Response("Not found", { status: 404 });

        const headers = new Headers();
        headers.set("Content-Type", upstream.headers.get("content-type") ?? contentTypeFor(name));
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        const cr = upstream.headers.get("content-range");
        if (cr) headers.set("Content-Range", cr);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
