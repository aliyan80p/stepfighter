# Email OTP 2FA — every login

After password sign-in, users receive a 6-digit code by email and must enter it before the app unlocks. Codes expire in 10 minutes.

## User flow

1. User submits email + password on `/auth` → Supabase session created.
2. App immediately sends a 6-digit code to their email and redirects to `/verify-2fa`.
3. User enters the code → verified flag set for 12 hours (per-device).
4. All `/dashboard`, `/tests`, `/admin`, etc. remain gated until verified. Signing out or 12h expiry re-triggers 2FA on next login.
5. "Resend code" button (60-second cooldown, max 5 codes per hour).

## Backend

**New table `login_otps`** (RLS: user reads/writes own):
- `user_id uuid` → `auth.users`
- `code_hash text` (SHA-256 of the 6-digit code + user_id salt)
- `expires_at timestamptz` (10 min)
- `consumed_at timestamptz`
- `attempts int` (lock after 5 wrong tries)
- `created_at timestamptz`

**New column `profiles.mfa_verified_until timestamptz`** — set 12h ahead on successful verify.

**Server functions** (all `requireSupabaseAuth`):
- `requestLoginOtp()` — rate-limit check, generate code, insert row, send email via `sendTemplateEmail('login-otp', user.email, { code })`.
- `verifyLoginOtp({ code })` — look up latest unconsumed row, compare hash, mark consumed, bump `mfa_verified_until`. Returns `{ ok, remainingAttempts }`.
- `getMfaStatus()` — returns `{ verified: boolean }` based on `mfa_verified_until > now()`.

**New email template** `login-otp.tsx` — branded StepFighter code email (large 6-digit code, 10-min expiry note).

## Frontend

- **`/auth`**: after successful `signInWithPassword`, call `requestLoginOtp` then `navigate('/verify-2fa')`.
- **New route `/verify-2fa`** (public, but requires session): 6-digit input, Verify button, Resend link with cooldown, Sign-out link.
- **Gate**: add a lightweight client-side check in `_authenticated` children via a shared `<Require2FA>` wrapper used by `dashboard.tsx`, `tests.tsx`, `admin.tsx`, and other top-level authenticated pages — redirects to `/verify-2fa` when `getMfaStatus()` returns `verified: false`. (Managed `_authenticated/route.tsx` is not modified.)
- Sign-out clears the local verified flag as usual.

## Security

- Codes hashed at rest (never store plaintext).
- 5 wrong attempts → row locked, must request a new code.
- 5 codes/hour per user (rate limited server-side via query on `login_otps`).
- 12-hour re-verification window is per browser session (stored in `profiles`, checked server-side on protected server fns for sensitive actions like admin routes).
- Admin routes additionally check `mfa_verified_until` server-side before returning data.

## Files touched

- Migration: `login_otps` table + RLS + grants; `profiles.mfa_verified_until` column.
- New: `src/lib/mfa.functions.ts`, `src/lib/email-templates/login-otp.tsx`, `src/routes/verify-2fa.tsx`, `src/components/require-2fa.tsx`.
- Edit: `src/lib/email-templates/registry.ts` (register template), `src/routes/auth.tsx` (post-login trigger), top-level authenticated route files (wrap with `<Require2FA>`).

Approve and I'll build it.