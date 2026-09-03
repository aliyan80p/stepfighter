/**
 * Fail-fast validation of server-side configuration.
 *
 * A missing signing key or backend credential must never degrade into a
 * silently insecure request path, so the Worker refuses to serve instead.
 */

const CRITICAL = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "MEDIA_TOKEN_SECRET",
  "OTP_PEPPER",
] as const;

let ok = false;

export function assertServerEnv(): string[] {
  // Only a passing result is cached. On Cloudflare Workers bindings are
  // injected per-request, so caching a failure from an early request would
  // wedge the Worker into a permanent 503.
  if (ok) return [];
  const missing = CRITICAL.filter((name) => !process.env[name]);
  if (missing.length) {
    // Names only — never the values.
    console.error(`[startup] Missing required configuration: ${missing.join(", ")}`);
  } else {
    ok = true;
  }
  return missing;
}
