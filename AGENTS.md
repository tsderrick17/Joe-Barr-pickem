<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Joe Barr Memorial Pick'em project instructions

## Start here

Before changing behavior, read [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md).
For operational or automation work, also read [docs/SOP_INDEX.md](docs/SOP_INDEX.md)
and the runbook it selects. For database work, read
[docs/supabase-github-cutover.md](docs/supabase-github-cutover.md).

Use this authority order when sources disagree:

1. Current timestamped migrations and the deployed database contract.
2. Executable tests.
3. Current application code.
4. `docs/PROJECT_REFERENCE.md` and accepted entries in `docs/DECISION_LOG.md`.
5. Older operational notes.

Do not silently choose between conflicting sources. Determine the implemented
rule, preserve user data, and update stale documentation in the same change.

## Non-negotiable pool rules

- Historical seasons, picks, scores, championships, and audit records remain
  available. A new season starts with blank games, picks, grades, and player
  season records; only the scoring-period template is copied.
- Every game is permanently pinned to its original scoring period and NFL
  gameweek. Provider schedule changes may adjust an unlocked future kickoff and
  line-lock time, but must never silently move a game between pool weeks.
- A missing or partial provider response is never deletion input. Locked,
  settled, re-paired, or cross-period schedule changes require review.
- A player may change an ATS or Survivor selection only until that game's
  kickoff. Other players' picks remain private until kickoff; a player can
  always see their own pick.
- Scores and grades are saved atomically from verified finals. ATS pushes are
  losses. Survivor uses straight-up results, and a tie is a loss.
- During the playoffs, players may submit the entire round. Eligibility is
  frozen at the beginning of each Eastern game day. A player remains eligible
  for every game on that day if they could tie the day-start leader. Once they
  cannot tie, future affected picks are voided and excluded from competitive
  totals rather than graded as losses.
- The major weekly recap is eligible Tuesday at 8:00 AM Eastern once results
  are trustworthy. The default week normally advances Wednesday at 3:00 AM
  Eastern and never earlier than 24 hours after the prior week settled, except
  when the next kickoff is less than 24 hours away. The next week is manually
  selectable on the next Eastern calendar day. Every completed week remains
  accessible.
- Scheduled automation is the primary path. Commissioner recovery controls
  must use the same authentication, execution leases, quota protection,
  gameweek pins, and atomic database functions as automation.

## Database and environment safety

- The root-level `supabase/001_*.sql` through `supabase/042_*.sql` files are
  historical build evidence. Never replay, reorder, edit, or deploy them.
- Every new database change is a new timestamped file in
  `supabase/migrations/`. Never modify an already-applied migration.
- Never use production for fixtures, destructive tests, season drills, or
  migration rehearsals. Those belong only in the confirmed `isolated-test`
  environment.
- Never place secrets, PINs, service-role keys, database passwords, access
  tokens, or production data in source, docs, logs, screenshots, or fixtures.
- Production mutations require the existing guarded workflow. Prefer read-only
  diagnosis; do not bypass an integrity trigger to make a symptom disappear.

## Working procedure

1. Inspect the working tree and preserve unrelated user changes.
2. Locate the governing rule in the project reference, decision log, tests,
   code, and latest migration before editing.
3. Add or update a regression test for every rule or bug fix.
4. If behavior, timing, operations, or a pool rule changes, update
   `docs/PROJECT_REFERENCE.md`, the relevant runbook, and
   `docs/DECISION_LOG.md` in the same pull request.
5. Run verification proportional to the change. The normal application gate is
   `npm run test:all`, `npm run lint`, and `npm run build`. Database behavior
   also requires the isolated integration workflow; lifecycle changes require
   the full-season drill. Mobile visual changes require an exact phone-width
   browser check in addition to automated tests.
6. Ship through a reviewed pull request with green application, deployment,
   and relevant database checks. Verify production after deployment for
   user-visible changes.

## Reference map

- [Project reference](docs/PROJECT_REFERENCE.md): authoritative product rules,
  lifecycle, architecture, and safety invariants.
- [SOP index](docs/SOP_INDEX.md): which procedure to use for routine work and
  incidents.
- [Decision log](docs/DECISION_LOG.md): why durable rules were chosen.
- [Game-day runbook](docs/GAME_DAY_RUNBOOK.md): short weekly commissioner flow.
- [Commissioner runbook](docs/commissioner-runbook.md): detailed recovery and
  release procedures.
- [Operations](docs/OPERATIONS.md): backups, provider efficiency, watchdogs,
  schedule automation, and upgrade rehearsals.
- [Isolated testing](docs/isolated-integration-tests.md): disposable database,
  browser, full-season, chaos, and replay testing.
- [Supabase cutover](docs/supabase-github-cutover.md): database migration rules.
- [Uptime monitoring](docs/uptime-monitoring.md): public availability checks.

## Code review rules

- Flag any path that can expose another player's unstarted pick.
- Flag any schedule update that can change a game's scoring period or pinned
  gameweek, delete a game because a provider omitted it, or reuse a stale line.
- Flag any scoring or rollover path that is not atomic, retry-safe, audited,
  and protected against overlapping runs.
- Flag any playoff calculation that uses results from after the Eastern
  day-start snapshot or grades an ineligible future pick instead of voiding it.
- Flag any new production database behavior without a timestamped migration,
  isolated coverage, and a documented recovery path.
