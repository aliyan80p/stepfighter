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

## Phase 2 — Freeze and final data sync — DONE (2026-09-03)

Run in one window, ideally at low traffic (early morning Karachi time).

1. Announce a short maintenance window (30–60 min).
2. Put the Lovable app in read-only mode *or* accept that writes in the window
   are lost — safest is to disable sign-ups/tests briefly.
3. `bun scripts/sync-user-data.mjs` — idempotent upsert of profiles, user_roles,
   user_entitlements, flashcard_decks, flashcards, flashcard_reviews, tests,
   attempts, bookmarks, question_notes, feedback, qbank_resets. Never deletes.
   Auth rows (`auth.users`, identities, mfa_factors) are compared with
   `export_auth_snapshot`; all 9 accounts already exist on the mirror.
4. Bump identity sequences on the mirror afterwards:
   `select setval(pg_get_serial_sequence('public.tests','id'), max(id))` and the
   same for `public.attempts` (otherwise new inserts collide).
5. `CONCURRENCY=12 bun scripts/mirror-media-bytes.mjs` for the media delta.
6. Verify counts on both sides.

Result of the final run: content parity exact (questions 16,602 / answers 87,628 /
refs 17,516 / library_docs 1,529 / library_toc 14,646 / subjects 27 / systems 70);
media 15,959 objects (1 delta file copied); user-side rows all present, mirror
slightly ahead due to local test accounts. Re-run steps 3–5 immediately before
the DNS switch to pick up anything written since.

---

## Phase 3 — Switch the domain

`stepfighter.com` DNS is currently managed inside Lovable, so the domain must be
moved out first:

1. Deploy the Worker and smoke test on `*.workers.dev`: sign in, image-heavy
   question, submit a test, statistics, flashcards, library PDF, password reset,
   OTP email.
2. At the **registrar** where `stepfighter.com` was bought, change the
   nameservers to the Cloudflare nameservers shown when you add the site in your
   own Cloudflare account (Add a site → stepfighter.com → Free plan). If the
   domain was purchased through Lovable, request the transfer/auth code first;
   until it is in your Cloudflare zone, Lovable controls the records.
3. In Supabase → Auth → URL configuration, set Site URL and Redirect URLs to
   `https://stepfighter.com`, `https://www.stepfighter.com` and the
   `*.workers.dev` domain.
4. In Cloudflare → the Worker → Domains & Routes, add `stepfighter.com` and
   `www.stepfighter.com` as custom domains; DNS records are created for you.
5. Wait for the certificate to issue, then verify HTTPS on both hostnames.
6. Keep the Lovable deployment alive on `stepfighter.lovable.app` for at least
   7 days as an instant rollback target — do not delete anything.

**Rollback:** point the custom domain back to the Lovable deployment. Any data
written to your Supabase during the rollback window must be re-synced back.


---

## Phase 4 — Backups on your own stack — configured (2026-09-03)

Lovable's Drive connector stops working after the cutover, so backups now run
entirely inside your own Supabase project.

What is already in place:

- `DISABLE_DRIVE_HOOKS=1` no longer disables the whole backup endpoint — it only
  skips the Google Drive half. `/api/public/hooks/backup` still writes the
  gzipped dated snapshot into the private `backups` bucket.
- `pg_cron` + `pg_net` enabled on your Supabase project.
- `public.trigger_backup(group)` (security definer, no anon/authenticated grant)
  reads `internal_config.hook_secret` and `internal_config.backup_base_url` and
  POSTs to `<base>/api/public/hooks/backup` with `x-hook-secret`.
- Six nightly jobs, staggered so each Worker invocation stays inside its memory
  and CPU budget (times are UTC — 01:00-01:40 Karachi):
  `sf-backup-users` 20:00, `sf-backup-auth` 20:05, `sf-backup-content` 20:10,
  `sf-backup-library` 20:20, `sf-backup-questions` 20:30, `sf-backup-answers` 20:40.
- Retention: newest 14 dated folders in the `backups` bucket; older ones pruned.

Remaining manual steps:

1. Deploy the Worker (`npx wrangler deploy`) so the updated backup route is live —
   until then the endpoint still answers 501 and the cron calls are no-ops.
2. Set `internal_config.backup_base_url` to `https://stepfighter.com` after the
   domain switch (it currently points at the `workers.dev` host).
3. Verify the first night: `select * from cron.job_run_details order by start_time desc limit 10;`
   and check that a `YYYY-MM-DD/` folder appeared in the `backups` bucket.
4. Off-site copy: a scheduled `wrangler` cron Worker pulling the dated folder into
   R2, or a weekly manual download.
5. Rehearse `docs/RESTORE.md` Section 6 once against a scratch project.

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
