import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFromBytes, decryptImdMedia, looksLikePlainMedia } from "@/lib/imd-media-crypto";

const BUCKET = "qbank-media";
const PLAIN_BUCKET = "qbank-media-plain";
// URL cache in worker memory (per-instance)
const plainUrlCache = new Map<string, { url: string; exp: number }>();

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

const HIGHRES_PREFIXES = ["highresdefault_", "hqdefault_", "sddefault_", "mqdefault_", "default_"];

function candidateNames(name: string): string[] {
  const set = new Set<string>();
  const bases = [name, stripPrefix(name)];
  for (const b of bases) {
    set.add(b);
    if (/^L\d/.test(b)) set.add("U" + b.slice(1));
    else if (/^U\d/.test(b)) set.add("L" + b.slice(1));
    // If no known CDN prefix, also try prefixed variants that live in the bucket
    const lower = b.toLowerCase();
    if (!HIGHRES_PREFIXES.some((p) => lower.startsWith(p))) {
      for (const p of HIGHRES_PREFIXES) set.add(p + b);
    }
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

function rangeResponse(data: Buffer, contentType: string, range: string | null): Response {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Disposition", "inline");

  const bodyFrom = (chunk: Uint8Array): ArrayBuffer => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer as ArrayBuffer;
  };

  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    headers.set("Content-Length", String(data.byteLength));
    return new Response(bodyFrom(data), { headers });
  }

  const total = data.byteLength;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
    headers.set("Content-Range", `bytes */${total}`);
    return new Response(null, { status: 416, headers });
  }

  const slice = data.subarray(start, end + 1);
  headers.set("Content-Length", String(slice.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  return new Response(bodyFrom(slice), { status: 206, headers });
}

async function getPlainSignedUrl(name: string, supaUrl: string, srk: string): Promise<string | null> {
  const now = Date.now();
  const cached = plainUrlCache.get(name);
  if (cached && cached.exp > now + 60_000) return cached.url;
  const res = await fetch(
    `${supaUrl}/storage/v1/object/sign/${PLAIN_BUCKET}/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${srk}`, apikey: srk, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
    },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const path = json.signedURL || json.signedUrl;
  if (!path) return null;
  const url = `${supaUrl}/storage/v1${path}`;
  plainUrlCache.set(name, { url, exp: now + 1000 * 60 * 60 * 24 * 300 });
  return url;
}

async function uploadPlain(name: string, data: Buffer, contentType: string, supaUrl: string, srk: string) {
  try {
    await fetch(`${supaUrl}/storage/v1/object/${PLAIN_BUCKET}/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${srk}`,
        apikey: srk,
        "Content-Type": contentType,
        "x-upsert": "true",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: data as any,
    });
  } catch {}
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

        // Fast path: redirect to signed URL from plaintext bucket (served by Supabase CDN).
        const signed = await getPlainSignedUrl(name, supaUrl, srk);
        if (signed) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: signed,
              "Cache-Control": "public, max-age=86400",
            },
          });
        }

        // Slow path: fetch encrypted, decrypt, respond, cache to plaintext bucket.
        const range = request.headers.get("range");
        const upstream = await resolveObject(name, supaUrl, srk, null);
        if (!upstream) return new Response("Not found", { status: 404 });

        const source = Buffer.from(await upstream.arrayBuffer());
        const resolvedName = nameCache.get(name) ?? name;
        const data = decryptImdMedia(source, [name, resolvedName, stripPrefix(name), stripPrefix(resolvedName)]);
        const type = contentTypeFromBytes(data, contentTypeFor(resolvedName));

        // Write-through cache to plain bucket for future requests (fire-and-forget).
        void uploadPlain(name, data, type, supaUrl, srk);

        return rangeResponse(data, type, range);
      },
    },
  },
});
