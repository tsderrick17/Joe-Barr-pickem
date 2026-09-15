# Maintenance checklist

Use this checklist for routine cleanup. It is intentionally separate from
game-day recovery so maintenance cannot become an excuse to change live pool
records.

## Weekly

- Review the latest **Production smoke gate** and encrypted-backup workflow.
- Confirm UptimeRobot has exactly one monitor for production, automation
  heartbeat, line-lock workers, score workers, reminder workers, Bowl Pool,
  critical workers, and encrypted backup.
- Review unresolved Commissioner incidents; do not delete open or unresolved
  records.
- Run `npm run test:all`, `npm run lint`, and `npm run build` before a release.

## Monthly

- Review `npm outdated` and upgrade only through the isolated monthly rehearsal.
- Remove stale local branches and old rehearsal artifacts after confirming they
  are not the source of an active pull request or certification evidence.
- Review environment variable names against the production and isolated-test
  deployment settings. Retire compatibility fallbacks only after a successful
  production preflight confirms the managed credential path.
- Check mobile and desktop pages at the exact widths used by the visual guards.

## Release hygiene

- Keep production changes in a reviewed pull request with green quality,
  isolated-database, deployment, and smoke checks.
- Keep `supabase/.temp/` and other local tool state untracked.
- Verify the canonical production site after deployment; never infer health
  from a successful build alone.
