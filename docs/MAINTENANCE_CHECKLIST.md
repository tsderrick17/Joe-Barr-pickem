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
- Use `npm run release:fetch`, `npm run release:check`, then one
  `npm run release:push` after the final commit; see the Commissioner release
  gate for authentication and production verification.

## Monthly

- Review `npm outdated` and upgrade only through the isolated monthly rehearsal.
- Remove stale local branches and old rehearsal artifacts after confirming they
  are not the source of an active pull request or certification evidence.
- Review environment variable names against the production and isolated-test
  deployment settings. Retire compatibility fallbacks only after a successful
  production preflight confirms the managed credential path.
- Check mobile and desktop pages at the exact widths used by the visual guards.
- Compare the project reference's stated cadence, provider sources, and season
  assumptions with the newest migrations and executable tests. Update stale
  runbook steps and mark superseded decision-log guidance explicitly.
- Review the monthly upgrade rehearsal's latest isolated report. A scheduled
  failure waits for a deliberate manual retry; do not silence the notification
  without understanding the failed test or dependency.

## Release hygiene

- Keep production changes in a reviewed pull request with green quality,
  isolated-database, deployment, and smoke checks.
- Keep `supabase/.temp/` and other local tool state untracked.
- Verify the canonical production site after deployment; never infer health
  from a successful build alone.
- Check Markdown links and examples in the same pull request as a documentation
  change. Keep the README understandable without access to private accounts or
  player data; put operational detail in the linked runbooks.
