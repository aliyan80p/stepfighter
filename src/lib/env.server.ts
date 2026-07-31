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

let checked = false;
let missing: string[] = [];

export function assertServerEnv(): string[] {
  if (checked) return missing;
  checked = true;
  missing = CRITICAL.filter((name) => !process.env[name]);
  if (missing.length) {
    // Names only — never the values.
    console.error(`[startup] Missing required configuration: ${missing.join(", ")}`);
  }
  return missing;
}
