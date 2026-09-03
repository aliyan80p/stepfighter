# Standby deployment (Cloudflare Workers + your own Supabase)

An independent disaster-recovery copy of StepFighter, running from this same
GitHub repository against your own Supabase project. The live Lovable
deployment is unaffected: every change in the repo is env-driven and falls back
to the current Lovable behaviour whenever the Lovable variables are present.

## 1. Environment variables

### Client-side (exposed to the browser — safe, RLS protects the data)

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable (anon) key |
| `VITE_SUPABASE_PROJECT_ID` | your project ref |

### Server-only (never prefix with `VITE_`)

| Name | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | same URL as above |
| `SUPABASE_PUBLISHABLE_KEY` | yes | same publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | bypasses RLS — server only |
| `MEDIA_TOKEN_SECRET` | yes | HMAC key for signed `/api/media/*` tokens |
| `OTP_PEPPER` | yes | **must be the current value** or existing OTP hashes stop matching |
| `GEMINI_API_KEY` | for AI | your own Google AI Studio key |
| `GEMINI_MODEL` | no | defaults to `gemini-2.5-flash` |
| `LEGACY_MEDIA_PASSWORD` | no | only for retired encrypted media |
| `WARM_MEDIA_SECRET`, `NBME_EXPORT_TOKEN` | no | bearer tokens for the public hook endpoints |
| `DISABLE_DRIVE_HOOKS` | recommended `1` | stops the standby from writing to the same Google Drive backup folder |

`src/lib/env.server.ts` refuses to serve unless `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `MEDIA_TOKEN_SECRET`
and `OTP_PEPPER` are all set.

## 2. What changes outside Lovable

| Feature | Standby behaviour |
| --- | --- |
| AI test analysis / prediction | uses `GEMINI_API_KEY` via Gemini's OpenAI-compatible endpoint; without a key the deterministic fallback text is used |
| Auth emails (signup, reset, magic link) | must be sent by Supabase SMTP — configure Zoho in Supabase Auth → SMTP |
| Login OTP 2FA email (`src/lib/mfa.functions.ts`) | uses `@lovable.dev/email-js`; needs an SMTP/provider swap or disable OTP on the standby |
| Google Drive backup / dedup / media warm | Lovable connector gateway only — set `DISABLE_DRIVE_HOOKS=1` |
| Lovable OAuth broker | unused (sign-in is email + password), no impact |
| Everything else — QBank, tests, attempts, statistics, flashcards, notes, library, media | works unchanged against your Supabase |

## 3. Build target — Cloudflare Workers

The build already targets Cloudflare: `@lovable.dev/vite-tanstack-config` uses
Nitro's Cloudflare preset by default, so `npm run build` needs no override.
`wrangler.jsonc` wires that output up:

- `main`: `.output/server/index.mjs`
- static assets: `.output/public`
- `compatibility_flags: ["nodejs_compat"]` — **required**, the app uses
  `node:crypto` for HMAC media tokens and OTP hashing.

Deploy either with Cloudflare **Workers Builds** (connect the GitHub repo;
build command `npm run build`, deploy command `npx wrangler deploy`) or
manually with `npx wrangler deploy` after a local build.

The `@lovable.dev/*` packages must remain resolvable from the registry at
install time.


## 4. Supabase configuration to recreate

- **Auth → URL configuration**: Site URL and Redirect URLs = the Workers domain
  (`<name>.workers.dev` at first).
- **Auth → Providers**: email enabled, anonymous sign-ups off, confirmations on.
- **Auth → SMTP**: your Zoho credentials.
- **Storage**: `qbank-media-plain` and `backups`, both private (already created).
  Raise the project upload limit to 500 MB if re-uploading the large videos.
- **Extensions**: `pg_cron` + `pg_net` only if you recreate the nightly jobs —
  do not point them at the same Drive folder as the live project.
- `internal_config.hook_secret` is already copied; it authenticates
  `/api/public/hooks/*`.

## 5. Deployment steps

1. In the Cloudflare dashboard: Workers & Pages → Create → connect this GitHub
   repository (a dedicated branch is recommended so the Lovable project keeps
   deploying from `main`).
2. Build command `npm run build`, deploy command `npx wrangler deploy`.
   Wrangler reads `wrangler.jsonc` for the entry point and assets.
3. Add every variable from section 1 — client `VITE_*` ones as build-time
   variables, all server-only ones as **encrypted secrets**
   (`npx wrangler secret put NAME`, or Settings → Variables and Secrets).
4. Deploy to the `*.workers.dev` domain first — no custom domain yet.
5. In Supabase, set Site URL / redirect URLs to that domain and configure SMTP.
6. Smoke test: sign in with an existing account, open a question with an image,
   submit a test, check statistics, check flashcards.
7. Only after all of the above passes, attach `stepfighter.com` as a Workers
   custom domain. Keep the Lovable deployment live until then.
