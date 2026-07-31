import { timingSafeEqual } from "node:crypto";

/**
 * Shared-secret gate for maintenance endpoints under /api/public/hooks/*.
 *
 * Those routes bypass site auth so the scheduler can reach them, and they run
 * with service-role access (they read every table, including auth snapshots).
 * The publishable key is shipped in the browser bundle, so it can never act as
 * the credential here. The real secret is generated inside the database and
 * read back with the service-role key, so it never lives in client code.
 */

let cached: { value: string; at: number } | null = null;
const TTL_MS = 60_000;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function loadSecret(supaUrl: string, srk: string): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const res = await fetch(
    `${supaUrl}/rest/v1/internal_config?key=eq.hook_secret&select=value`,
    { headers: { apikey: srk, Authorization: `Bearer ${srk}`, Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ value?: string }>;
  const value = rows[0]?.value;
  if (!value) return null;
  cached = { value, at: Date.now() };
  return value;
}

/**
 * Returns `null` when the caller is authorised, otherwise the Response to send.
 */
export async function requireHookSecret(request: Request): Promise<Response | null> {
  const supaUrl = process.env.SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !srk) {
    return Response.json({ error: "not configured" }, { status: 500 });
  }
  const expected = await loadSecret(supaUrl, srk);
  const provided = request.headers.get("x-hook-secret") ?? "";
  if (!expected || provided === "" || !safeEqual(provided, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
