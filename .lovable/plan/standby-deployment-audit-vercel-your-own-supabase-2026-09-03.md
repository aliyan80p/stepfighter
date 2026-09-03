# Standby deployment audit (Vercel + your own Supabase)

Read-only audit. Nothing in the live Lovable project or its Cloud data was touched, and nothing will be until you approve.

## 1. Environment variables required outside Lovable

**Browser / client-side (safe to expose, RLS protects data)**
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — your publishable/anon key
- `VITE_SUPABASE_PROJECT_ID`

**Server-only (never prefix with VITE_)**
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `MEDIA_TOKEN_SECRET` — HMAC key for signed media URLs
- `OTP_PEPPER` — must be the **same value as today**, or existing 2FA/OTP hashes stop matching
- `LEGACY_MEDIA_PASSWORD` — only needed if legacy encrypted media is ever re-read
- `WARM_MEDIA_SECRET`, `NBME_EXPORT_TOKEN` — shared bearer tokens for the public hook endpoints
- `GOOGLE_DRIVE_API_KEY` / Drive credentials — only if you keep the Drive backup pipeline
- New for the standby: `GEMINI_API_KEY` (replacing `LOVABLE_API_KEY`), and an SMTP/Resend key for email

The startup guard in `src/lib/env.server.ts` refuses to serve unless `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `MEDIA_TOKEN_SECRET`, `OTP_PEPPER` are all present.

## 2. Features that stop working outside Lovable

| Feature | Where | Impact |
|---|---|---|
| AI Test Analysis + AI wording in Improvements | `src/lib/performance.functions.ts` (2 calls to `ai.gateway.lovable.dev`) | Fails without `LOVABLE_API_KEY`; needs your Gemini key |
| Auth emails (signup, reset, magic link, OTP) | `src/routes/lovable/email/*`, `src/lib/email-templates/send-email.ts` (`@lovable.dev/email-js`) | No emails send; login OTP / password reset break |
| Google Drive backup + dedup + media warm | `src/routes/api/public/hooks/*`, `src/routes/api/media/$.ts` fallback | Uses `connector-gateway.lovable.dev`; needs a direct Google service account |
| Lovable OAuth broker | `src/integrations/lovable/index.ts` | Currently unused by the sign-in UI (email+password only), so no user impact |
| Preview auth storage shim | `src/integrations/supabase/previewAuthStorage.ts` | Harmless outside the Lovable iframe |

Everything else — QBank, tests, attempts, flashcards, notes, bookmarks, library, statistics, peer ranking, score calculator, media serving from Supabase storage — is plain Supabase and works unchanged.

## 3. Replacing Lovable AI with your own Gemini key

Two call sites, both in `src/lib/performance.functions.ts` (lines ~462–500 and ~760–780). Change per site:
- read `process.env['GEMINI_API_KEY']` instead of `LOVABLE_API_KEY`
- POST to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with `x-goog-api-key`, or keep the OpenAI-compatible shape via Gemini's `/v1beta/openai/chat/completions` endpoint (smallest diff — only URL, header and model string change)
- model `google/gemini-3.5-flash` → `gemini-2.5-flash`
- add `https://generativelanguage.googleapis.com` to `connect-src` in `src/lib/security-headers.ts`

The existing deterministic fallbacks already cover AI failure, so a missing key degrades gracefully rather than crashing.

## 4. Vercel readiness

Not ready as-is; three build-level items:
1. The build goes through `@lovable.dev/vite-tanstack-config`, whose Nitro target defaults to **Cloudflare Workers**. For Vercel it must be built with the `vercel` Nitro preset (`NITRO_PRESET=vercel`), or swapped to a plain TanStack Start Vite config in the standby fork.
2. `src/server.ts` (the SSR wrapper) and the `node:crypto` usage are Node-compatible, so the Vercel Node runtime is fine — do not use the Edge runtime.
3. `@lovable.dev/*` packages (`vite-tanstack-config`, `email-js`, `cloud-auth-js`, `webhooks-js`) resolve from Lovable's registry. The standby fork should either keep registry access or replace them (email-js and cloud-auth-js are the only two with runtime behaviour).

Otherwise the app is a standard TanStack Start SSR app and deploys normally.

## 5. External configuration to recreate in your Supabase

- **Auth settings**: Site URL and Redirect URLs set to the Vercel domain (and `stepfighter.com` if you point it there); email confirmations on; anonymous sign-ups off; password policy.
- **SMTP**: your Zoho credentials in Supabase Auth → SMTP, so Supabase sends auth emails directly instead of the Lovable webhook.
- **Storage**: buckets `qbank-media-plain` and `backups` exist and are private (correct). Raise the project-level upload size limit to 500 MB in your dashboard if you re-upload the 3 large videos.
- **pg_cron jobs**: deliberately not copied. Recreate nightly `backup`, `drive-mirror`, `drive-dedup` only if you want the standby to also push to Drive — running both projects against the same Drive folder will create duplicates.
- **Extensions**: confirm `pg_cron` and `pg_net` are enabled before recreating jobs.
- **Secrets**: `hook_secret` row in `internal_config` (already copied) is what the maintenance endpoints authenticate against.

## 6. Safe step-by-step deployment plan

1. **Branch, don't edit main.** Create a `standby` branch in your GitHub repo. All changes below land there, so the Lovable project keeps building from `main` untouched.
2. **Swap the build target** on that branch: Nitro `vercel` preset, add `vercel.json` if needed.
3. **Swap AI**: the two Gemini call sites + CSP entry.
4. **Swap email**: point auth emails at Supabase SMTP (Zoho) and replace the one transactional caller (`src/lib/mfa.functions.ts` login OTP) with a direct provider, or disable OTP 2FA on the standby.
5. **Neutralise Drive hooks** on the standby (return 501) so the two deployments never fight over the same Drive folder.
6. **Configure Vercel**: import the repo, select the `standby` branch, add every env var from section 1, deploy to a preview URL only — no custom domain yet.
7. **Recreate Supabase Auth config**: Site URL + redirect URLs = the Vercel preview URL, SMTP, providers.
8. **Smoke test** on the Vercel URL: sign in with an existing account, open a question with an image, submit a test, check statistics, check flashcards.
9. **Only after it passes**, decide whether to attach `stepfighter.com` — and keep Lovable live until then.

Nothing in steps 1–9 writes to Lovable Cloud.
