
# Launch Plan — Trust, Trial & 2FA

Building all three phases in one coordinated rollout so you can start inviting real users.

## Phase 1 — Verified Signups & Trust

**Signup form** (`/auth?mode=signup`)
- Full name (required)
- Email + password (required)
- Country (dropdown)
- Medical school (text)
- Select QBank(s) they want access to: Step 1 / Step 2 CK / Step 3 (multi-select, at least one)
- Target exam date (optional, powers Score Predictor defaults)

**Email verification (mandatory)**
- Disable auto-confirm — users MUST click the link in their inbox to activate.
- Branded auth emails (signup confirmation, password reset, magic link) styled to match the QBank navy theme.
- Custom sender: `noreply@qbanks.lovable.app` (or your custom domain when ready).

**Password reset**
- "Forgot password?" link on the auth page.
- `/reset-password` route to set a new password.

**Security hardening**
- Leaked-password protection (HIBP) enabled — blocks common breached passwords.
- Raise auth email rate limit to 200/hour to handle launch traffic.
- Google sign-in stays available.

## Phase 2 — Free Trial System

**Database schema**
- `profiles` gets: `full_name`, `country`, `medical_school`, `target_exam`, `target_date`, `selected_qbanks` (text[]).
- New `user_entitlements` table: `plan` ('trial'|'paid'|'expired'), `trial_started_at`, `trial_ends_at`, `qbank_access` (text[]).
- DB trigger: on signup → create profile + entitlement row with 14-day trial and their selected QBanks.

**Access gate**
- Server-side check on every question load — if trial expired AND not paid → redirect to `/upgrade`.
- Only grants access to QBanks the user selected at signup (upgradable later).

**Trial UI**
- Sidebar banner: "X days left in your free trial" (turns amber at ≤3 days, red at ≤1).
- `/upgrade` page (pricing placeholder — no payments yet, just a "Contact us" form until Phase 4).
- Post-trial state: read-only access to Performance/Notes/Flashcards they created, but questions locked.

## Phase 3 — Email OTP 2FA (USMLE Fighter style)

**Flow**
- Optional per-user toggle in `/account/settings` — "Enable 2FA on login".
- When enabled: after correct password, send 6-digit code to their email, valid 10 min.
- 2FA challenge page: enter code → session created.
- "Trust this device for 30 days" checkbox → stored in signed cookie, skips 2FA on that browser.
- Rate-limited: max 5 code sends per hour, max 5 wrong attempts before lockout.

**Backend**
- `email_otps` table: `user_id`, `code_hash`, `expires_at`, `attempts`, `consumed_at`.
- `trusted_devices` table: `user_id`, `device_token_hash`, `expires_at`.
- Server functions: `sendLoginOtp`, `verifyLoginOtp`, `revokeTrustedDevice`.

## Phase 4 (LATER — when ready to charge) — Pricing tiers

Based on USMLE Fighter model:
- Single QBank: 1 mo / 3 mo / 6 mo / 12 mo tiers
- Multi-QBank bundles (Step 1+2, all three) at a discount
- Stripe checkout + webhooks → auto-flip `plan` to `paid`

**Not building payments yet** — you asked for free trial first. When you're ready, one message and I'll wire Stripe on top of the entitlement system already in place.

## Admin Dashboard (bonus, ships with Phase 2)

Route `/admin` (gated to your user ID only initially):
- Signups over time, active trials, conversion funnel
- Most-attempted questions, average scores
- Feedback submissions & flagged questions
- Email delivery status (bounces, complaints)

Lets you "analyze data and take AI help to resolve issues" as you mentioned.

## Technical Details

**New tables**
- `user_entitlements`: RLS — user reads own, service_role writes.
- `email_otps`: service_role only, never exposed to client.
- `trusted_devices`: service_role only.
- `admin_users`: single-row table for admin RBAC (`has_role(uid,'admin')`).

**Auth changes**
- `supabase--configure_auth`: `auto_confirm_email: false`, `password_hibp_enabled: true`, `rate_limit_email_sent: 200`.
- Scaffold branded auth email templates.

**New routes**
- `/reset-password` (public)
- `/verify-2fa` (public, session pending)
- `/upgrade` (authenticated)
- `/admin/*` (admin-gated pathless layout)

**Server functions**
- `completeSignupProfile`, `getEntitlement`, `sendLoginOtp`, `verifyLoginOtp`, admin analytics fns.

**Access enforcement**
- Middleware on `test.$id.tsx` loader checks entitlement + QBank access.
- `_authenticated/route.tsx` redirects to `/verify-2fa` if session has pending 2FA flag.

## Rollout order

1. Auth config + password reset + branded emails (Phase 1) — ~30 min
2. Profile fields + entitlements + trial banner + `/upgrade` (Phase 2) — ~1 hr
3. Email OTP 2FA + trusted devices (Phase 3) — ~1 hr
4. Admin analytics dashboard — ~45 min

Total: shipped in one session. Existing users (you) get grandfathered as `paid` so nothing breaks.

Approve and I'll start with Phase 1.
