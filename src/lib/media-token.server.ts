import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  // Dedicated signing key only — never reuse the service-role key for signing.
  const s = process.env.MEDIA_TOKEN_SECRET;
  if (!s) throw new Error("media-token secret not configured");
  return s;
}

/**
 * Short-lived signed token binding a user to a specific qbank for media access.
 * Format: base64url(payload).base64url(HMAC-SHA256(payload))
 * Payload: { u: userId, q: qbankId, e: expEpochSeconds }
 */
export function signMediaToken(
  userId: string,
  qbankId: number,
  ttlSeconds = 60 * 60,
): { token: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ u: userId, q: qbankId, e: exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, expiresAt: exp * 1000 };
}

export function verifyMediaToken(
  token: string | null | undefined,
  qbankId: number,
): { ok: boolean; userId?: string } {
  if (!token) return { ok: false };
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected: string;
  try {
    expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  } catch {
    return { ok: false };
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: string; q?: number; e?: number;
    };
    if (typeof decoded.e !== "number" || decoded.e * 1000 < Date.now()) return { ok: false };
    if (Number(decoded.q) !== Number(qbankId)) return { ok: false };
    return { ok: true, userId: String(decoded.u ?? "") };
  } catch {
    return { ok: false };
  }
}
