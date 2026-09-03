/**
 * Response hardening applied to every request the Worker serves.
 */

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.SUPABASE_URL ?? "https://example.supabase.co").origin;
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` on script-src is required: the framework serializes the
 * hydration payload into inline <script> tags, and the app has no nonce
 * plumbing. Everything else is locked to our own origin plus the backend.
 */
function csp(): string {
  const backend = SUPABASE_ORIGIN;
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob: ${backend}`,
    `media-src 'self' data: blob: ${backend}`,
    `connect-src 'self' ${backend} https://ai.gateway.lovable.dev https://generativelanguage.googleapis.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function withSecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // HSTS only over HTTPS — sending it on plain HTTP (local dev) is invalid.
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // CSP applies to documents; skipping it for assets/JSON avoids breaking
  // media streaming and keeps the header off large binary responses.
  const type = headers.get("content-type") ?? "";
  if (type.includes("text/html")) {
    headers.set("Content-Security-Policy", csp());
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
