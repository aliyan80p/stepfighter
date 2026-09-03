# StepFighter standby + reconnection roadmap

- [x] Connect Google Drive in the new workspace
- [x] Document where to obtain Cloudflare standby secrets (docs/STANDBY-DEPLOY.md)
- [x] Replace Lovable email SDK for login OTP on standby (EMAIL_PROVIDER=brevo)

## Full migration off Lovable (docs/CUTOVER.md)

- [ ] Phase 0 — standby readiness verified (deploy, data, media, auth)
- [ ] Phase 2 — freeze window + final data/media delta sync
- [ ] Phase 3 — custom domain moved to the Cloudflare Worker
- [ ] Phase 4 — backups rebuilt without the Lovable Drive connector
- [ ] Phase 5 — decommission Lovable, rotate secrets, drop @lovable.dev deps
