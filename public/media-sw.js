/**
 * StepFighter media cache service worker.
 *
 * Purpose: once a question's images/videos/audio are fetched, subsequent
 * loads (refresh, revisit) should NOT re-download them. The media URL
 * carries a rotating `?t=<hmac>` token that busts the HTTP cache, so we
 * key our own cache by pathname only.
 *
 * Scope: only /api/media/** requests. Everything else falls through to
 * the network untouched.
 */

const CACHE_NAME = "sf-media-v3";
const MEDIA_PREFIX = "/api/media/";

self.addEventListener("install", (event) => {
  // Activate immediately so the very next media request is intercepted.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop any stale caches from prior versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Cache key = origin + pathname (no query string). This makes /api/media/foo.png
 * a single cache entry regardless of the `?v=` build tag or the per-session `?t=`
 * signed token.
 */
function cacheKey(url) {
  return new Request(url.origin + url.pathname, { method: "GET" });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(MEDIA_PREFIX)) return;
  // Range requests (video/audio seek) must not be served from Cache Storage —
  // the browser expects a 206 Partial Content, but Cache.match returns 200.
  if (req.headers.has("range")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const key = cacheKey(url);
      const isRetry = url.searchParams.has("r");
      const cached = await cache.match(key);
      if (cached && !isRetry) return cached;
      try {
        const fresh = await fetch(req);
        // Only cache successful, full (200) responses that we can replay.
        // A retry request (`?r=`) intentionally bypasses stale cache first,
        // then replaces it when the media route returns a healthy response.
        if (fresh.ok && fresh.status === 200 && fresh.type !== "opaque") {
          cache.put(key, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        // Offline / network error — last resort: any cached copy.
        const fallback = await cache.match(key);
        if (fallback) return fallback;
        throw err;
      }
    })(),
  );
});
