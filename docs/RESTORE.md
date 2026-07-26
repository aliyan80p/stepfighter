# StepFighter — Disaster Recovery Runbook

**Status: documented, partially tested.** The backup side is verified end-to-end
(all four nightly groups have exported successfully). The restore side has been
dry-run against the backup archives, but a full rebuild into a brand-new empty
project has **not** been executed. Do a rehearsal (Section 6) before you need it.

---

## 1. What the backups actually contain

Every night, a dated folder `YYYY-MM-DD/` is written to **both** the private
`backups` storage bucket and the **StepFighter Backups** Google Drive folder.
14 snapshots are retained in each place.

| File | Contents |
|---|---|
| `users-*.json.gz` | profiles, user_roles, user_entitlements, attempts, tests, bookmarks, flashcards, flashcard_decks, flashcard_reviews, question_notes, feedback, qbank_resets, internal_config |
| `questions-*.json.gz` | questions, answers (chunked, 25k rows/file) |
| `content-*.json.gz` | qbank_media, refs, library_docs, library_toc, subjects, systems, qbanks |
| `auth-*.json.gz` | auth.users (incl. bcrypt password hashes), auth.identities, auth.mfa_factors |

Each file is gzipped JSON: `{ "table": "<name>", "rows": [ ... ] }`.

### What is NOT in the backups

1. **Schema.** Tables, RLS policies, functions and triggers come from
   `supabase/migrations/*.sql` in the GitHub repo — not from the JSON dumps.
   The repo is therefore part of the backup set. Keep it.
2. **Storage media files** (`qbank-media`, `qbank-media-plain`). Only the
   `qbank_media` *index rows* are backed up. The binaries are re-warmed from the
   original Google Drive source folders (Section 5).
3. **Secrets.** `NBME_EXPORT_TOKEN`, `WARM_MEDIA_SECRET`, connector keys etc.
   must be re-entered by hand in the new project.
4. **Active user sessions.** Everyone is logged out after a restore; passwords
   still work because the hashes are restored.

---

## 2. Answer to "can a brand-new project be fully restored?"

Yes — **provided you still have two things**: (a) the GitHub repo (schema), and
(b) at least one dated backup folder from Drive or the bucket (data). Losing the
Lovable account alone loses nothing: the repo and the Drive copies live outside it.

The one component that cannot be reconstructed from the backups alone is the
media binaries; those depend on your original Drive source folders still existing.

---

## 3. Restore procedure

### 3.0 Prerequisites
- A new Supabase project (or Lovable Cloud project).
- Its `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The backup folder downloaded locally, e.g. `./backup/2026-07-26/`.
- Node 20+.

### 3.1 Recreate the schema
```bash
# from the repo root, against the new project's DB connection string
for f in supabase/migrations/*.sql; do psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```
Run them in filename order — they are timestamp-prefixed and idempotent enough to
apply to an empty database. Verify afterwards that `public.has_role`,
`public.has_qbank_access`, `public.pick_question_ids` and `public.pool_count` exist.

### 3.2 Restore auth accounts (do this FIRST)
Everything else has foreign keys to `auth.users`, so auth goes first.

```bash
NEW_DB_URL="postgresql://..." node scripts/restore.mjs auth ./backup/2026-07-26
```
This inserts `auth.users`, `auth.identities` and `auth.mfa_factors` over a direct
Postgres connection, preserving `id`, `email`, `encrypted_password` and
`email_confirmed_at`. A direct DB connection is required — the GoTrue admin API
cannot faithfully round-trip hashes and identity rows.

> If the new project has a `handle_new_user` trigger on `auth.users`, disable it
> for the duration of the auth restore or it will fight the profile restore:
> `ALTER TABLE auth.users DISABLE TRIGGER USER;` … re-enable after.

### 3.3 Restore application tables
```bash
SUPABASE_URL="https://xxx.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/restore.mjs data ./backup/2026-07-26
```
Order is enforced by the script: `content` → `questions` → `users`. It upserts in
batches of 500 through PostgREST with the service role (bypasses RLS).

### 3.4 Reset sequences
Identity/serial columns must be bumped past the restored max id:
```sql
SELECT setval(pg_get_serial_sequence(t, 'id'), COALESCE((SELECT MAX(id) FROM public.questions), 1))
-- repeat per table with a serial id: questions, answers, qbanks, subjects, systems, refs, library_docs, library_toc
```
`scripts/restore.mjs sequences` prints the exact statements for the current schema.

### 3.5 Re-enter secrets and reconnect
- Google Drive connector (used by backups + media warming).
- `WARM_MEDIA_SECRET`, `NBME_EXPORT_TOKEN`, any payment/support values.
- Re-point `stepfighter.com` DNS / custom domain at the new deployment.
- Re-create the four `pg_cron` backup jobs (Section 4).

---

## 4. Re-creating the nightly cron jobs

```sql
select cron.schedule('backup-users','0 2 * * *', $$select net.http_post(
  url:='https://stepfighter.com/api/public/hooks/backup?group=users',
  headers:='{"apikey":"<publishable key>"}'::jsonb)$$);
-- questions 30 2 * * * · content 0 3 * * * · auth 30 3 * * *
```

---

## 5. Restoring media binaries

**Primary path — Drive mirror (exact copy of the buckets).**
`POST /api/public/hooks/media-backup` mirrors every object in `qbank-media`
and `qbank-media-plain` into Google Drive → **StepFighter Media Backup** →
one sub-folder per bucket. Nested keys are flattened with `__`
(`step1/L62835.jpg` → `step1__L62835.jpg`), so restoring means downloading a
bucket folder and re-uploading each file with `__` turned back into `/`.
Progress lives in `public.media_backup_log`; check it with
`{"status": true}`. Cron runs every 10 minutes, 120 files per run — the
initial ~19k-file / ~4.4 GB sync takes about a day, after that only new or
changed files upload.

**Fallback — rebuild from source.** The `qbank_media` rows carry the storage
paths. Re-run the warm-media endpoint with `WARM_MEDIA_SECRET` pointed at the
original Drive source folders; it re-uploads every missing object.
Expect ~11.6k question media + ~5.7k library images, several hours.


---

## 6. Rehearsal checklist (do this once, on a throwaway project)

- [ ] Create a scratch Supabase project
- [ ] Apply all migrations — no errors
- [ ] Restore `auth` — sign in as a real user with their old password
- [ ] Restore `content`, `questions`, `users`
- [ ] Reset sequences, then create a new question/test — no PK collision
- [ ] Generate a quiz — pool count non-zero, question renders
- [ ] Confirm an attempt from the old data shows in Performance
- [ ] Warm a handful of media, confirm images render
- [ ] Delete the scratch project

Record the date of the last successful rehearsal here: **not yet performed**.
