# StepFighter — full cutover from Lovable Cloud to your own Cloudflare + Supabase

This is the ordered runbook to stop being dependent on Lovable: hosting moves to
Cloudflare Workers, the database/auth/storage move to your own Supabase project
(the one currently running as standby, ref `veqealgeqcvmqpujdlgo`), and email
moves to Brevo + Supabase SMTP.

Companion docs: `docs/STANDBY-DEPLOY.md` (env + deploy details),
`docs/RESTORE.md` (disaster recovery), `docs/standby-grants.sql`.

---

## Phase 0 — What must be true before you start

- [x] Standby Worker live and clean on `stepfighter-5859cf60.aliyan80p.workers.dev`
      (200, no console errors, no failed requests, `/api/media/*` rejects unsigned tokens).
- [x] Schema parity: 28 RLS policies, 10 functions, RLS on every public table,
      all four sequences granted to `authenticated`.
- [x] Content parity: questions 16,602 / answers 87,628 / refs 17,516 /
      qbank_media 15,555 / library_docs 1,529 / library_toc 14,646 — identical both sides.
- [x] Media parity: `qbank-media-plain` 15,959 objects / 3,820 MB — identical.
      (Only the `backups` bucket, 1,246 files, is Lovable-side; rebuilt in Phase 4.)
- [x] Auth config: Brevo SMTP live, sign-ups on, confirmations on, link expiry 600s.
- [ ] Manual smoke test with a real account: sign in, OTP email, password reset.
- [ ] You own the domain DNS (`stepfighter.com`) at your registrar / Cloudflare.

---

## Phase 1 — Feature parity checklist (things Lovable provides today)

| Lovable feature | Replacement on your stack | Status |
| --- | --- | --- |
| Hosting / SSR | Cloudflare Workers (`wrangler.jsonc`) | ready |
| Database, auth, storage | your Supabase project | ready |
| Auth emails (signup/reset/magic) | Supabase SMTP (Zoho or Brevo SMTP) | configure in Supabase → Auth → SMTP |
| Login OTP 2FA email | Brevo API — set `EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` | ready in code |
| AI test analysis | `GEMINI_API_KEY` (Google AI Studio) — else deterministic fallback | set key |
| Google Drive nightly backup / dedup / media warm | Lovable connector gateway only → set `DISABLE_DRIVE_HOOKS=1`, replace with Supabase `backups` bucket + pg_cron (Phase 4) | needs setup |
| Lovable OAuth broker | unused (email + password sign-in) | no action |

---

## Phase 2 — Freeze and final data sync

Do this in one window, ideally at low traffic (early morning Karachi time).

1. Announce a short maintenance window (30–60 min).
2. Put the Lovable app in read-only mode *or* simply accept that writes in the
   window are lost — the safest option is to disable sign-ups/tests briefly.
3. Re-run the mirror of user-side tables from Lovable → your Supabase
   (profiles, user_roles, user_entitlements, attempts, tests, bookmarks,
   flashcards*, question_notes, feedback, qbank_resets) plus `auth.users`,
   `auth.identities`, `auth.mfa_factors` via `export_auth_snapshot`.
4. Re-run the media delta sync (`scripts/mirror-media-bytes.mjs`) so any files
   added since the last mirror are copied.
5. Verify row counts match on both sides for every table before continuing.

---

## Phase 3 — Switch the domain

1. Deploy the Worker and smoke test on `*.workers.dev`:
   sign in, image-heavy question, submit a test, statistics, flashcards,
   library PDF, password reset, OTP email.
2. In Supabase → Auth → URL configuration, set Site URL and Redirect URLs to
   `https://stepfighter.com`, `https://www.stepfighter.com` and the
   `*.workers.dev` domain.
3. In Cloudflare → the Worker → Domains & Routes, add `stepfighter.com` and
   `www.stepfighter.com` as custom domains. DNS records are created for you.
4. Wait for the certificate to issue, then verify HTTPS on both hostnames.
5. Keep the Lovable deployment alive (on `stepfighter.lovable.app`) for at
   least 7 days as an instant rollback target — do not delete anything.

**Rollback:** point the custom domain back to the Lovable deployment. Any data
written to your Supabase during the rollback window must be re-synced back.

---

## Phase 4 — Rebuild backups on your own stack

Lovable's Drive connector stops working after the cutover, so:

1. Set `DISABLE_DRIVE_HOOKS=1` on the Worker.
2. Keep nightly dumps into the private Supabase `backups` bucket via pg_cron +
   pg_net calling `/api/public/hooks/backup` with the `internal_config.hook_secret`
   bearer token (the endpoint already writes the bucket copy).
3. Add an off-site copy: either a scheduled `wrangler` cron Worker that pulls the
   dated folder into R2, or a weekly manual download to Drive/local disk.
4. Rehearse `docs/RESTORE.md` Section 6 once against a scratch project.

---

## Phase 5 — Decommission Lovable (only after 7+ clean days)

1. Remove `stepfighter.com` from the Lovable project.
2. Rotate every secret that Lovable ever held: `MEDIA_TOKEN_SECRET` (invalidates
   existing signed media URLs — harmless, they are short-lived), `OTP_PEPPER`
   (**only if you accept that pending OTPs break**; existing hashes stop matching),
   `NBME_EXPORT_TOKEN`, `WARM_MEDIA_SECRET`, `hook_secret`, Supabase service key.
3. Export a final backup of the Lovable Supabase project and archive it.
4. Optionally strip `@lovable.dev/*` packages from `package.json` — the email
   SDK, cloud-auth and error reporting become dead code once `EMAIL_PROVIDER=brevo`
   and the broker is unused. Do this as a separate PR after the domain is stable.

---

## Cloudflare Worker variables (final list)

Build-time (plain vars): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`, `DISABLE_DRIVE_HOOKS=1`, `EMAIL_PROVIDER=brevo`.

Secrets (`npx wrangler secret put NAME`): `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_TOKEN_SECRET`,
`OTP_PEPPER`, `BREVO_API_KEY`, `GEMINI_API_KEY`, `NBME_EXPORT_TOKEN`,
`WARM_MEDIA_SECRET`, `LEGACY_MEDIA_PASSWORD` (optional).
