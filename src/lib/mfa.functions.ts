import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto'
import { z } from 'zod'

// Persistent until sign-out: ~100 years. clearMfaVerification() resets on logout.
const VERIFY_WINDOW_HOURS = 24 * 365 * 100
const CODE_TTL_MIN = 10
const MAX_ATTEMPTS = 5
const MAX_CODES_PER_HOUR = 5
const RESEND_COOLDOWN_SEC = 60

/**
 * Keyed (peppered) hash of a one-time code. A 6-digit code has only 10^6
 * possible values, so a bare SHA-256 digest in the database could be reversed
 * instantly by anyone who read the table. HMAC with a server-held pepper means
 * the stored digest is useless without the runtime secret. Plaintext codes are
 * never stored, logged, or returned to the client.
 */
function hashCode(userId: string, code: string): string {
  const pepper = process.env.OTP_PEPPER
  if (!pepper) throw new Error('OTP hashing is not configured')
  return `v2:${createHmac('sha256', pepper).update(`${userId}:${code}`).digest('hex')}`
}

/** Legacy unsalted digest — accepted only for codes issued before the upgrade. */
function legacyHashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}


/** Returns whether the current session already satisfies 2FA. */
export const getMfaStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from('profiles')
      .select('mfa_verified_until')
      .eq('id', context.userId)
      .maybeSingle()
    const until = data?.mfa_verified_until ? new Date(data.mfa_verified_until).getTime() : 0
    return { verified: until > Date.now() }
  })

/** Generates a code, stores its hash, and emails it. Rate-limited. */
export const requestLoginOtp = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Rate limit: last hour
    const { data: recent } = await supabaseAdmin
      .from('login_otps')
      .select('id, created_at')
      .eq('user_id', context.userId)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })

    if (recent && recent.length >= MAX_CODES_PER_HOUR) {
      throw new Error('Too many codes requested. Please wait an hour and try again.')
    }
    if (recent && recent.length > 0) {
      const lastMs = new Date(recent[0].created_at).getTime()
      const waitSec = Math.ceil((RESEND_COOLDOWN_SEC * 1000 - (Date.now() - lastMs)) / 1000)
      if (waitSec > 0) {
        throw new Error(`Please wait ${waitSec}s before requesting another code.`)
      }
    }

    // Look up caller email
    const { data: userRes, error: userErr } = await context.supabase.auth.getUser()
    if (userErr || !userRes?.user?.email) throw new Error('Unable to look up account email')
    const email = userRes.user.email

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString()

    const { error: insErr } = await supabaseAdmin.from('login_otps').insert({
      user_id: context.userId,
      code_hash: hashCode(context.userId, code),
      expires_at: expiresAt,
    })
    if (insErr) throw new Error(insErr.message)

    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    const result = await sendTemplateEmail('login-otp', email, {
      templateData: { code, minutes: CODE_TTL_MIN },
      idempotencyKey: `login-otp-${context.userId}-${Date.now()}`,
    })
    if (!result.sent) {
      throw new Error('This email address is blocked from receiving mail. Contact support.')
    }
    return { sent: true, maskedEmail: maskEmail(email) }
  })


/** Verifies the latest unconsumed code; on success bumps mfa_verified_until. */
export const verifyLoginOtp = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().trim().regex(/^\d{6}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows } = await supabaseAdmin
      .from('login_otps')
      .select('id, code_hash, expires_at, consumed_at, attempts')
      .eq('user_id', context.userId)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    const row = rows?.[0]
    if (!row) return { ok: false, error: 'No active code. Request a new one.' as const, remaining: 0 }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, error: 'Code expired. Request a new one.' as const, remaining: 0 }
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return { ok: false, error: 'Too many attempts. Request a new code.' as const, remaining: 0 }
    }

    const expected = hashCode(context.userId, data.code)
    if (expected !== row.code_hash) {
      const newAttempts = row.attempts + 1
      await supabaseAdmin.from('login_otps').update({ attempts: newAttempts }).eq('id', row.id)
      return {
        ok: false,
        error: 'Incorrect code.' as const,
        remaining: Math.max(0, MAX_ATTEMPTS - newAttempts),
      }
    }

    const verifiedUntil = new Date(Date.now() + VERIFY_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    await supabaseAdmin.from('login_otps').update({ consumed_at: new Date().toISOString() }).eq('id', row.id)
    await context.supabase.from('profiles').update({ mfa_verified_until: verifiedUntil }).eq('id', context.userId)
    return { ok: true as const }
  })


/** Clears the persistent MFA verification for the current user (called on sign-out). */
export const clearMfaVerification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from('profiles').update({ mfa_verified_until: null }).eq('id', context.userId)
    return { ok: true as const }
  })

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const shown = local.slice(0, 2)
  return `${shown}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}
