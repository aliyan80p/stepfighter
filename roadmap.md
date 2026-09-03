# StepFighter standby + reconnection roadmap

- [x] Connect Google Drive in the new workspace
- [x] Document where to obtain Cloudflare standby secrets (docs/STANDBY-DEPLOY.md)
- [x] Replace Lovable email SDK for login OTP on standby (EMAIL_PROVIDER=brevo)

## Full migration off Lovable (docs/CUTOVER.md)

- [x] Phase 0 — standby readiness verified (deploy, data, media, auth)
- [x] Phase 2 — final data/media delta sync run + verified (scripts/sync-user-data.mjs)
- [ ] Phase 3 — move stepfighter.com DNS out of Lovable into your Cloudflare, then attach to the Worker
- [x] Phase 4 — nightly bucket backups via pg_cron on your Supabase (deploy Worker + off-site copy pending)
- [ ] Phase 5 — decommission Lovable, rotate secrets, drop @lovable.dev deps
