# StepFighter — repeat the whole move, from scratch

The exact sequence that worked the first time: from a Lovable-hosted app to
your own Cloudflare Worker + your own Supabase + Brevo email.
Companion docs: `STANDBY-DEPLOY.md` (env + deploy), `CUTOVER.md` (the switch),
`RESTORE.md` (disaster recovery), `standby-grants.sql`.

---

## Step 1 — Create your own Supabase project

1. New project in your own Supabase account, same region as before.
2. Copy the project URL, publishable (anon) key, service-role key, project ref.
3. Storage → create two **private** buckets: `qbank-media-plain` and `backups`.
   Raise the upload limit to 500 MB.
4. Auth → Providers: email on, anonymous sign-ups off, confirmations on.
5. Auth → link expiry (`mailer_otp_exp`) = **600** seconds.

## Step 2 — Copy the schema and content

1. Dump schema + data from the source project (`pg_dump --schema=public`), restore
   into the new one.
2. Run `docs/standby-grants.sql` — a schema copy brings table grants but **not**
   sequence grants; without it inserts fail with
   `permission denied for sequence tests_id_seq` ("test cannot be created").
3. Verify RLS is on for every public table, and the policies/functions came across.

## Step 3 — Copy the media bytes

```
CONCURRENCY=12 bun scripts/mirror-media-bytes.mjs
```
Then compare object count and total size on both sides. Expect ~15,959 objects.

## Step 4 — Copy users and user data

```
bun scripts/sync-user-data.mjs
```
Idempotent upsert, never deletes: profiles, roles, entitlements, decks, cards,
reviews, tests, attempts, bookmarks, notes, feedback, resets, plus the auth
snapshot. Afterwards bump the sequences:

```sql
select setval(pg_get_serial_sequence('public.tests','id'), max(id)) from public.tests;
select setval(pg_get_serial_sequence('public.attempts','id'), max(id)) from public.attempts;
```

## Step 5 — Email on your own stack

- Brevo account → SMTP credentials into Supabase → Auth → SMTP (verified sender).
- Brevo API key as the Worker secret `BREVO_API_KEY`, plus `EMAIL_PROVIDER=brevo`
  so the login-OTP mail stops using the Lovable SDK.
- Apply the branded templates (`docs/standby-recovery-email.html`,
  `src/lib/email-templates/*`) in Auth → Email templates; keep
  `{{ .ConfirmationURL }}` as the button link and the copy at 10 minutes.

## Step 6 — Deploy the Worker

1. Cloudflare → Workers & Pages → connect this GitHub repo (own branch).
2. Build command `npm run build:cf`, deploy command `npx wrangler deploy`.
   `build:cf` deletes `.wrangler/deploy/config.json`; without that removal the
   Worker serves no static assets (unstyled page, broken images).
3. Variables — build-time: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`, `DISABLE_DRIVE_HOOKS=1`, `EMAIL_PROVIDER=brevo`.
   Secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_TOKEN_SECRET`, `OTP_PEPPER` (must be the
   **current** value or existing OTP hashes stop matching), `BREVO_API_KEY`,
   `GEMINI_API_KEY`, `NBME_EXPORT_TOKEN`, `WARM_MEDIA_SECRET`.
4. Deploy to `*.workers.dev` first. Set that URL as Supabase Site URL for now.

## Step 7 — Smoke test on workers.dev

Sign in · an image-heavy question · submit a test · statistics · flashcards ·
library PDF · password reset email · login OTP email · `/api/media/*` must
reject an unsigned request with 401.

## Step 8 — Backups on your own stack

`pg_cron` + `pg_net` enabled, `internal_config.hook_secret` and
`backup_base_url` set, `public.trigger_backup(group)` plus the six staggered
nightly jobs (users/auth/content/library/questions/answers), 14-day retention
into the `backups` bucket. Verify with
`select * from cron.job_run_details order by start_time desc limit 10;`
and an off-site copy (R2 cron Worker or weekly download).

## Step 9 — The domain switch (do last)

1. Domain must sit in **your** Cloudflare zone and show Active. If it was bought
   through Lovable, get the transfer/auth code first.
2. Re-run Steps 3–4 (delta sync) immediately before the switch.
3. Remove the old `@` / `www` A records that point at the Lovable IP, then add
   `stepfighter.com` and `www.stepfighter.com` as Worker custom domains —
   Cloudflare writes the DNS records itself.
4. Supabase → Auth → URL configuration: Site URL + Redirect URLs =
   `https://stepfighter.com`, `https://www.stepfighter.com`, the workers.dev host.
5. Set `internal_config.backup_base_url` to `https://stepfighter.com`, redeploy.
6. Wait for the certificate, verify HTTPS on both hostnames.

## Step 10 — Decommission (after 7+ clean days)

Remove the domain from the old project, rotate every secret the old host held,
archive a final backup, then drop the `@lovable.dev/*` packages in a separate PR.

---

### The three things that bit us last time

1. Missing **sequence grants** → "test cannot be created".
2. `.wrangler/deploy/config.json` left in place → Worker serves no static assets.
3. Changing DNS **before** the Worker custom domain exists → downtime. Always
   attach the Worker first in the same sitting you delete the old A records.
