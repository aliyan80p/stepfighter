import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFromBytes, decryptImdMedia, looksLikePlainMedia } from "@/lib/imd-media-crypto";
import { verifyMediaToken } from "@/lib/media-token.server";

const BUCKET = "qbank-media";
const PLAIN_BUCKET = "qbank-media-plain";

// Per-worker caches
const plainUrlCache = new Map<string, { url: string; exp: number }>();
const plainNameCache = new Map<string, string | null>();
const nameCache = new Map<string, string | null>();
const driveIdCache = new Map<string, string | null>();

const QBANK_SLUGS: Record<string, number> = { step1: 2, step2: 1, step3: 3 };

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

function normalizeMediaLeafCase(name: string): string {
  return name.replace(
    /^((?:highresdefault_|hqdefault_|sddefault_|mqdefault_|default_)?)([ul])(\d)/i,
    (_match, prefix: string, letter: string, digit: string) => `${prefix}${letter.toUpperCase()}${digit}`,
  );
}

function extensionVariants(name: string): string[] {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return [name];
  const base = name.slice(0, dot);
  const ext = name.slice(dot + 1);
  const variants = new Set<string>([
    name,
    `${base}.${ext.toLowerCase()}`,
    `${base}.${ext.toUpperCase()}`,
  ]);
  if (/^jpg$/i.test(ext)) {
    variants.add(`${base}.jpeg`);
    variants.add(`${base}.JPEG`);
  } else if (/^jpeg$/i.test(ext)) {
    variants.add(`${base}.jpg`);
    variants.add(`${base}.JPG`);
  }
  return Array.from(variants);
}

function candidateNames(name: string): string[] {
  const set = new Set<string>();
  const normalized = normalizeMediaLeafCase(name);
  const baseSeeds = [normalized, name, stripPrefix(normalized), stripPrefix(name)];
  const bases: string[] = [];
  for (const b of baseSeeds) for (const v of extensionVariants(b)) bases.push(v);
  for (const b of bases) {
    set.add(b);
    if (/^[a-z]/.test(b)) set.add(b[0].toUpperCase() + b.slice(1));
    if (/^[A-Z]/.test(b)) set.add(b[0].toLowerCase() + b.slice(1));
    if (/^[Ll]\d/.test(b)) {
      set.add("L" + b.slice(1)); set.add("l" + b.slice(1));
    }
    if (/^[Uu]\d/.test(b)) {
      set.add("U" + b.slice(1)); set.add("u" + b.slice(1));
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

function upstreamMediaResponse(res: Response, fallbackContentType: string): Response {
  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("content-type") || fallbackContentType);
  headers.set("Accept-Ranges", res.headers.get("accept-ranges") || "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Disposition", "inline");
  const contentLength = res.headers.get("content-length");
  const contentRange = res.headers.get("content-range");
  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange) headers.set("Content-Range", contentRange);
  return new Response(res.body, {
    status: res.status === 206 ? 206 : 200,
    headers,
  });
}

async function probePlainPath(
  path: string,
  supaUrl: string,
  srk: string,
  range: string | null,
): Promise<Response | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${srk}`, apikey: srk };
  if (range) headers.Range = range;
  const res = await fetch(
    `${supaUrl}/storage/v1/object/${PLAIN_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
    { headers },
  );
  if (!(res.ok || res.status === 206)) {
    try { await res.body?.cancel(); } catch {}
    return null;
  }
  return res;
}

/**
 * Fetch one exact storage path. Returns a ready-to-send Response, or null when
 * the object is missing / still encrypted.
 */
async function fetchPlainExact(
  path: string,
  requestedPath: string,
  supaUrl: string,
  srk: string,
  range: string | null,
): Promise<Response | null> {
  const res = await probePlainPath(path, supaUrl, srk, range);
  if (!res) return null;
  if (!range && contentTypeFor(path).startsWith("image/")) {
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!looksLikePlainMedia(bytes)) return null;
    const type = contentTypeFromBytes(bytes, contentTypeFor(path));
    if (path !== requestedPath) void uploadPlain(requestedPath, bytes, type, supaUrl, srk);
    return rangeResponse(bytes, type, null);
  }
  return upstreamMediaResponse(res, contentTypeFor(path));
}

/**
 * Resolve the first hit among several candidate paths, probing them in
 * parallel batches instead of one slow sequential request at a time.
 * Order is preserved: the earliest candidate that exists wins.
 */
async function firstPlainHit(
  paths: string[],
  requestedPath: string,
  supaUrl: string,
  srk: string,
  range: string | null,
  concurrency = 6,
): Promise<{ path: string; response: Response } | null> {
  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (path) => ({
        path,
        response: await fetchPlainExact(path, requestedPath, supaUrl, srk, range).catch(() => null),
      })),
    );
    const hit = results.find((r) => r.response);
    if (hit) return { path: hit.path, response: hit.response! };
  }
  return null;
}

async function fetchPlainObject(
  storagePath: string,
  cacheKey: string,
  supaUrl: string,
  srk: string,
  range: string | null,
): Promise<Response | null> {
  const cached = plainNameCache.get(cacheKey);
  const dir = storagePath.includes("/") ? storagePath.slice(0, storagePath.lastIndexOf("/") + 1) : "";
  const leaf = storagePath.slice(dir.length);
  const candidatePaths = Array.from(new Set([storagePath, ...candidateNames(leaf).map((candidate) => dir + candidate)]));
  const paths = cached === undefined
    ? candidatePaths
    : cached ? [cached, ...candidatePaths.filter((path) => path !== cached)] : [];
  if (!paths.length) return null;

  const hit = await firstPlainHit(paths, storagePath, supaUrl, srk, range);
  if (hit) {
    plainNameCache.set(cacheKey, hit.path);
    return hit.response;
  }
  if (cached === undefined) plainNameCache.set(cacheKey, null);
  return null;
}


async function fetchPlainUrlFromDb(
  qbankId: number, name: string, supaUrl: string, srk: string,
): Promise<string | null> {
  const candidates = candidateNames(name);
  const orExpr = candidates.map((c) => `name.eq.${encodeURIComponent(c)}`).join(",");
  const url =
    `${supaUrl}/rest/v1/qbank_media?select=name,plain_url,plain_url_expires_at` +
    `&qbank_id=eq.${qbankId}&or=(${orExpr})&plain_url=not.is.null&limit=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${srk}`, apikey: srk } });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ name: string; plain_url: string; plain_url_expires_at: string | null }>;
  if (!rows.length) return null;
  // Prefer the row whose name most closely matches the requested one.
  // Exact > case-insensitive exact > has original-style prefix > shorter name.
  const strippedReq = stripPrefix(name).toLowerCase();
  const scored = rows.map((r) => {
    let score = 0;
    if (r.name === name) score += 1000;
    else if (r.name.toLowerCase() === name.toLowerCase()) score += 500;
    // Match core (post-prefix) name exactly — critical to distinguish L↔U variants
    if (stripPrefix(r.name).toLowerCase() === strippedReq) score += 300;
    if (/^(highresdefault_|hqdefault_|sddefault_|mqdefault_|default_)/i.test(r.name)) score += 100;
    score -= r.name.length;
    return { r, score };
  }).sort((a, b) => b.score - a.score);

  const row = scored[0].r;
  if (row.plain_url_expires_at) {
    const exp = Date.parse(row.plain_url_expires_at);
    if (Number.isFinite(exp) && exp < Date.now() + 60_000) return null;
  }
  return row.plain_url;
}

async function persistPlainUrl(
  qbankId: number, name: string, plainUrl: string, expiresAt: string,
  supaUrl: string, srk: string,
) {
  try {
    await fetch(`${supaUrl}/rest/v1/qbank_media?on_conflict=qbank_id,name`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${srk}`, apikey: srk,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{
        qbank_id: qbankId, name, drive_file_id: "",
        plain_url: plainUrl, plain_url_expires_at: expiresAt,
      }]),
    });
  } catch {}
}

async function getPlainSignedUrl(
  storagePath: string, cacheKey: string, supaUrl: string, srk: string,
): Promise<{ url: string; expiresAt: string } | null> {
  const now = Date.now();
  const cached = plainUrlCache.get(cacheKey);
  if (cached && cached.exp > now + 60_000) {
    return { url: cached.url, expiresAt: new Date(cached.exp).toISOString() };
  }

  const paths = new Set<string>([storagePath]);
  const dir = storagePath.includes("/") ? storagePath.slice(0, storagePath.lastIndexOf("/") + 1) : "";
  const leaf = storagePath.slice(dir.length);
  for (const c of candidateNames(leaf)) paths.add(dir + c);

  const expiresIn = 60 * 60 * 24 * 365;
  for (const p of paths) {
    const res = await fetch(
      `${supaUrl}/storage/v1/object/sign/${PLAIN_BUCKET}/${p.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${srk}`, apikey: srk, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn }),
      },
    );
    if (!res.ok) continue;
    const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const path = json.signedURL || json.signedUrl;
    if (!path) continue;
    const url = `${supaUrl}/storage/v1${path}`;
    const exp = now + expiresIn * 1000;
    plainUrlCache.set(cacheKey, { url, exp });
    return { url, expiresAt: new Date(exp).toISOString() };
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
        // Reject anything that could escape the media namespace once the
        // storage URL is normalized (e.g. "..%2F..%2Fbackups/dump.json"),
        // which would otherwise read from other private buckets.
        const isSafeSegment = (s: string) => /^[A-Za-z0-9._-]+$/.test(s) && s !== "." && s !== "..";
        if (!segments.length || !segments.every(isSafeSegment)) {
          return new Response("Bad request", { status: 400 });
        }
        let qbankId = 1;
        let qbankSlug = "";
        let name = segments[segments.length - 1] ?? "";
        if (segments.length >= 2 && QBANK_SLUGS[segments[0]] !== undefined) {
          qbankSlug = segments[0];
          qbankId = QBANK_SLUGS[qbankSlug];
        }
        if (!name) return new Response("Bad request", { status: 400 });


        // Require a valid, entitlement-checked media token bound to this qbank.
        // The token is minted by getMediaToken() only for users whose plan
        // grants access to this qbank, so unauthenticated / unpaid callers
        // cannot fetch decrypted files even by guessing filenames.
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        const auth = verifyMediaToken(token, qbankId);
        if (!auth.ok) return new Response("Unauthorized", { status: 401 });

        const supaUrl = process.env.SUPABASE_URL;
        const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supaUrl || !srk) return new Response("Media service not configured", { status: 500 });

        const storagePrefix = qbankSlug ? `${qbankSlug}/` : "";
        const cacheKey = `${qbankId}:${name}`;
        const mediaType = contentTypeFor(name);
        const isImage = mediaType.startsWith("image/");

        const range = request.headers.get("range");

        // Fastest path: stream warmed media through this same route instead of
        // redirecting the browser to a signed storage URL.  This avoids blank
        // images on stricter browsers/devices while still using the warmed copy.
        const plainObject = await fetchPlainObject(`${storagePrefix}${name}`, cacheKey, supaUrl, srk, range);
        if (plainObject) return plainObject;

        // Cross-namespace fallback. Medical Library articles are shared by all
        // qbanks, but their images were warmed under whichever qbank namespace
        // first requested them (root / step1 / step3). Without this fallback a
        // Step 2 user gets 404s for every library image warmed under step1, and
        // vice versa — which is why "some" media loads and some never does.
        const altPrefixes = ["", "step1/", "step3/"].filter((p) => p !== storagePrefix);
        for (const alt of altPrefixes) {
          const altObject = await fetchPlainObject(`${alt}${name}`, `${alt}|${name}`, supaUrl, srk, range);
          if (altObject) return altObject;
        }


        // Images must never bypass this route via old signed URLs: affected
        // highresdefault_* records can have stale cached links, which causes
        // persistent broken icons on iOS/Android/Chrome even after storage repair.
        if (!isImage) {
          // Backward-compatible fallback: DB-cached signed URL (survives worker restarts)
          const dbUrl = await fetchPlainUrlFromDb(qbankId, name, supaUrl, srk);
          if (dbUrl) {
            plainUrlCache.set(cacheKey, { url: dbUrl, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
            return new Response(null, {
              status: 302,
              headers: { Location: dbUrl, "Cache-Control": "public, max-age=86400" },
            });
          }
        }

        if (!isImage) {
          // Fast path: sign the plain bucket + persist for other workers
          const signed = await getPlainSignedUrl(`${storagePrefix}${name}`, cacheKey, supaUrl, srk);
          if (signed) {
            void persistPlainUrl(qbankId, name, signed.url, signed.expiresAt, supaUrl, srk);
            return new Response(null, {
              status: 302,
              headers: { Location: signed.url, "Cache-Control": "public, max-age=86400" },
            });
          }
        }

        // Slow path: get encrypted source
        let encrypted: { bytes: Buffer; resolvedName: string } | null = null;
        if (qbankId === 1) {
          const upstream = await resolveEncryptedFromBucket(name, supaUrl, srk);
          if (upstream) {
            encrypted = {
              bytes: Buffer.from(await upstream.arrayBuffer()),
              resolvedName: nameCache.get(name) ?? name,
            };
          }
        }
        if (!encrypted) {
          encrypted = await resolveEncryptedFromDrive(qbankId, name, supaUrl, srk);
        }
        if (!encrypted) {
          // Library images are indexed under whichever qbank imported them, so
          // fall back to the other qbanks' media index before giving up.
          for (const altQbank of [1, 2, 3].filter((q) => q !== qbankId)) {
            encrypted = await resolveEncryptedFromDrive(altQbank, name, supaUrl, srk);
            if (encrypted) break;
          }
        }
        if (!encrypted) return new Response("Not found", { status: 404 });


        const { bytes, resolvedName } = encrypted;
        const data = decryptImdMedia(bytes, [name, resolvedName, stripPrefix(name), stripPrefix(resolvedName)]);
        const type = contentTypeFromBytes(data, contentTypeFor(resolvedName));

        void (async () => {
          const resolvedPath = `${storagePrefix}${resolvedName}`;
          const requestedPath = `${storagePrefix}${name}`;
          await uploadPlain(resolvedPath, data, type, supaUrl, srk);
          if (requestedPath !== resolvedPath) {
            await uploadPlain(requestedPath, data, type, supaUrl, srk);
          }
          const s = await getPlainSignedUrl(`${storagePrefix}${resolvedName}`, cacheKey, supaUrl, srk);
          if (s) await persistPlainUrl(qbankId, resolvedName, s.url, s.expiresAt, supaUrl, srk);
        })();

        return rangeResponse(data, type, range);

      },
    },
  },
});
