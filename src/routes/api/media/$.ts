import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFromBytes, decryptImdMedia } from "@/lib/imd-media-crypto";

const BUCKET = "qbank-media";
const PLAIN_BUCKET = "qbank-media-plain";

// Per-worker caches
const plainUrlCache = new Map<string, { url: string; exp: number }>();
const nameCache = new Map<string, string | null>();
const driveIdCache = new Map<string, string | null>();

const QBANK_SLUGS: Record<string, number> = { step1: 2, step2: 1 };

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
    if (/^[a-z]/.test(b)) set.add(b[0].toUpperCase() + b.slice(1));
    if (/^[A-Z]/.test(b)) set.add(b[0].toLowerCase() + b.slice(1));
    if (/^[LlUu]\d/.test(b)) {
      const rest = b.slice(1);
      set.add("L" + rest); set.add("U" + rest);
      set.add("l" + rest); set.add("u" + rest);
    }
    const lower = b.toLowerCase();
    if (!HIGHRES_PREFIXES.some((p) => lower.startsWith(p))) {
      for (const p of HIGHRES_PREFIXES) set.add(p + b);
    }
  }
  return Array.from(set);
}

async function resolveEncryptedFromBucket(
  name: string, supaUrl: string, srk: string,
): Promise<Response | null> {
  const cached = nameCache.get(name);
  const tryNames = cached === undefined ? candidateNames(name) : cached ? [cached] : [];
  for (const n of tryNames) {
    const url = `${supaUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(n)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${srk}`, apikey: srk } });
    if (res.ok) { nameCache.set(name, n); return res; }
  }
  if (cached === undefined) nameCache.set(name, null);
  return null;
}

async function resolveEncryptedFromDrive(
  qbankId: number, name: string, supaUrl: string, srk: string,
): Promise<{ bytes: Buffer; resolvedName: string } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) return null;

  const cacheKey = `${qbankId}:${name}`;
  let fileId: string | null | undefined = driveIdCache.get(cacheKey);
  let resolvedName = name;

  if (fileId === undefined) {
    // Lookup by exact name or case-insensitive candidates via PostgREST
    const candidates = candidateNames(name);
    const orExpr = candidates.map((c) => `name.eq.${encodeURIComponent(c)}`).join(",");
    const url = `${supaUrl}/rest/v1/qbank_media?select=name,drive_file_id&qbank_id=eq.${qbankId}&or=(${orExpr})&limit=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${srk}`, apikey: srk } });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ name: string; drive_file_id: string }>;
      if (rows[0]) { fileId = rows[0].drive_file_id; resolvedName = rows[0].name; }
      else fileId = null;
    } else fileId = null;
    driveIdCache.set(cacheKey, fileId);
  }
  if (!fileId) return null;

  const dl = await fetch(
    `https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey } },
  );
  if (!dl.ok) return null;
  return { bytes: Buffer.from(await dl.arrayBuffer()), resolvedName };
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

async function getPlainSignedUrl(
  storagePath: string, cacheKey: string, supaUrl: string, srk: string,
): Promise<string | null> {
  const now = Date.now();
  const cached = plainUrlCache.get(cacheKey);
  if (cached && cached.exp > now + 60_000) return cached.url;

  // Try direct path first
  const paths = new Set<string>([storagePath]);
  // Also try case variants for the leaf name
  const dir = storagePath.includes("/") ? storagePath.slice(0, storagePath.lastIndexOf("/") + 1) : "";
  const leaf = storagePath.slice(dir.length);
  for (const c of candidateNames(leaf)) paths.add(dir + c);

  for (const p of paths) {
    const res = await fetch(
      `${supaUrl}/storage/v1/object/sign/${PLAIN_BUCKET}/${p.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${srk}`, apikey: srk, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
      },
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const path = json.signedURL || json.signedUrl;
    if (!path) continue;
    const url = `${supaUrl}/storage/v1${path}`;
    plainUrlCache.set(cacheKey, { url, exp: now + 1000 * 60 * 60 * 24 * 300 });
    return url;
  }
  return null;
}

async function uploadPlain(storagePath: string, data: Buffer, contentType: string, supaUrl: string, srk: string) {
  try {
    await fetch(`${supaUrl}/storage/v1/object/${PLAIN_BUCKET}/${storagePath.split("/").map(encodeURIComponent).join("/")}`, {
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
        if (!raw) return new Response("Bad request", { status: 400 });
        const segments = raw.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
        let qbankId = 1;
        let qbankSlug = "";
        let name = segments[segments.length - 1] ?? "";
        if (segments.length >= 2 && QBANK_SLUGS[segments[0]] !== undefined) {
          qbankSlug = segments[0];
          qbankId = QBANK_SLUGS[qbankSlug];
        }
        if (!name) return new Response("Bad request", { status: 400 });

        const supaUrl = process.env.SUPABASE_URL;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supaUrl || !srk) return new Response("Media service not configured", { status: 500 });

        const storagePrefix = qbankSlug ? `${qbankSlug}/` : "";
        const cacheKey = `${qbankId}:${name}`;

        // Fast path: signed URL from plain bucket
        const signed = await getPlainSignedUrl(`${storagePrefix}${name}`, cacheKey, supaUrl, srk);
        if (signed) {
          return new Response(null, {
            status: 302,
            headers: { Location: signed, "Cache-Control": "public, max-age=86400" },
          });
        }

        const range = request.headers.get("range");

        // Slow path: get encrypted source
        let encrypted: { bytes: Buffer; resolvedName: string } | null = null;
        if (qbankId === 1) {
          // Legacy: bucket-hosted
          const upstream = await resolveEncryptedFromBucket(name, supaUrl, srk);
          if (upstream) {
            encrypted = {
              bytes: Buffer.from(await upstream.arrayBuffer()),
              resolvedName: nameCache.get(name) ?? name,
            };
          }
        }
        if (!encrypted) {
          // Fallback / step1: fetch from Google Drive via connector
          encrypted = await resolveEncryptedFromDrive(qbankId, name, supaUrl, srk);
        }
        if (!encrypted) return new Response("Not found", { status: 404 });

        const { bytes, resolvedName } = encrypted;
        const data = decryptImdMedia(bytes, [name, resolvedName, stripPrefix(name), stripPrefix(resolvedName)]);
        const type = contentTypeFromBytes(data, contentTypeFor(resolvedName));

        void uploadPlain(`${storagePrefix}${resolvedName}`, data, type, supaUrl, srk);

        return rangeResponse(data, type, range);
      },
    },
  },
});
