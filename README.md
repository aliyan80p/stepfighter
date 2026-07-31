# StepFighter

USMLE Step 1 / Step 2 CK / Step 3 question bank, flashcards, medical library and
performance analytics. Built with TanStack Start (React 19 + Vite) on Lovable Cloud.

## Security & secrets

All credentials are environment variables — there are **no secret string literals
anywhere in the source tree**. See `.env.example` for the full list.

| Where it runs | Variables |
| --- | --- |
| Browser (`import.meta.env`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| Server only (`process.env`) | `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_TOKEN_SECRET`, `LEGACY_MEDIA_PASSWORD`, `WARM_MEDIA_SECRET`, `NBME_EXPORT_TOKEN`, `LOVABLE_API_KEY`, `GOOGLE_DRIVE_API_KEY`, `NEW_DB_URL` |

Rules enforced in this repo:

- The publishable (anon) key is client-side **only because Row Level Security is
  enabled on all 24 tables in the `public` schema**. Never add a table without
  RLS + policies + grants.
- The service-role key bypasses RLS. It is read only inside server-function and
  server-route handlers via `@/integrations/supabase/client.server`, never at
  module scope of a client-reachable file, and never behind a `VITE_` prefix.
- Never prefix a sensitive value with `VITE_` (or `NEXT_PUBLIC_` / `REACT_APP_`);
  those are inlined into the browser bundle at build time.
- `.env` is git-ignored. Only `.env.example`, with placeholders, is committed.
- Never `console.log` or return a token, key, or connection string in an API
  response or error message.

### ⚠️ Rotate previously hardcoded secrets

Two non-service credentials were previously hardcoded in source
(`src/lib/imd-media-crypto.ts` and `scripts/decrypt-media.mjs`: the legacy media
decryption passphrase) and have now been moved to `LEGACY_MEDIA_PASSWORD`.
**Removing a value from the working tree does not remove it from git history** —
anyone with repo access can still read the old commits.

If you ever hardcode a credential:

1. Rotate/revoke it at the provider immediately — assume it is public.
2. Update the value via the Lovable secrets manager (not in a committed file).
3. Optionally purge history with `git filter-repo` / BFG and force-push.

The legacy media passphrase is a decryption key for retired third-party media
that is no longer served (all media is stored already-decrypted); it grants no
account access, so it cannot be "rotated" — treat it as compromised and do not
rely on it for confidentiality.

## Backups

Nightly database snapshots to the private `backups` bucket + Google Drive, plus
an incremental media mirror. Restore procedure: `docs/RESTORE.md`.
