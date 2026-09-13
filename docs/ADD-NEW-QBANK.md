# Adding a new QBank (test in Lovable, then push to your own site)

Code and data travel on two separate tracks. Code goes through GitHub; questions
never do — they are copied database-to-database.

## 1. Add the course data in Lovable

Import/migrate the new course into the Lovable database. Test it on the Lovable
preview until you are happy with it.

## 2. Copy the questions into your own Supabase

Ask Lovable to run:

```bash
node scripts/sync-qbank-content.mjs --qbank=<slug>            # report + copy
node scripts/sync-qbank-content.mjs --qbank=<slug> --dry-run  # report only
node scripts/sync-qbank-content.mjs                           # every course
```

Copies: `qbanks`, `subjects`, `systems`, `questions`, `answers`, `refs`,
`library_docs`, `library_toc`, `qbank_media`.
It only adds/updates rows — it never deletes anything on your side.

Credentials come from workspace secrets: source `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY`, destination `MANAGED_SUPABASE_URL` /
`MANAGED_SUPABASE_SERVICE_ROLE_KEY`.

## 3. Copy the images

`scripts/mirror-media-bytes.mjs` copies the actual image files into your own
storage bucket. Row data alone is not enough if the pictures are new.

## 4. Push the code

GitHub → Actions → **Sync to old repo** → Run workflow. Cloudflare deploys and
`https://stepfighter.com` shows the new course.
