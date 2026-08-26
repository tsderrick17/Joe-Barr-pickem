# Joe Barr Memorial Pick'em project reference

Last verified against `main`: 2026-08-25.

This is the durable product and system reference for the Joe Barr Memorial
Pick'em application. It explains what must remain true across code changes,
provider failures, NFL schedule changes, weekly progression, playoffs, and
annual rollover. `AGENTS.md` loads the short mandatory rules; this file holds
the detailed context behind them.

## Product in one paragraph

The application runs a private, season-long NFL pool with two related games.
Pick'em players select teams against a locked official spread. Survivor players
select one straight-up winner per regular-season scoring period without reusing
a team. The same Slate, schedule, final-score provider, audit system, and
commissioner controls support both pools, while scoring and history remain
separate.

## Terminology

- **Season**: one annual pool, moving through `preseason`, `regular_season`,
  `playoffs`, and `complete`.
- **Scoring period**: a pool week or playoff round. Exactly one period may be
  active at a time.
- **Gameweek pin**: the immutable relationship between an NFL game, its
  original scoring period, and its original NFL gameweek.
- **Official line**: the spread captured at the game's configured line-lock
  time. It is never replaced retroactively by a later market line.
- **Settled week**: every game is final or formally resolved, every applicable
  pick is graded or voided, and the database can close the period atomically.
- **Default week**: the completed or upcoming period shown when a player first
  opens the site. This does not limit which completed weeks are accessible.
- **Void pick**: a retained audit fact that is excluded from active limits,
  scoring totals, championships, and Survivor team reuse. It is not a loss.

## Sources of truth

When investigating behavior, use this order:

1. `supabase/migrations/` for the current database contract.
2. `test/` for executable rule examples.
3. `src/lib/` and API routes for application orchestration.
4. This reference and accepted decisions in `docs/DECISION_LOG.md`.
5. Operational runbooks for human procedure.

The root-level numbered SQL files under `supabase/` describe the original
database build only. They are not the current migration stream and must never
be replayed.

## System boundaries

- **Next.js/Vercel** serves the player pages, Commissioner tools, API routes,
  health endpoint, and manual recovery controls.
- **Supabase/Postgres** owns durable state, row-level security, integrity
  triggers, atomic mutations, audit logs, execution leases, and scheduled jobs.
- **NFL schedule provider** supplies the canonical 272-game regular-season
  structure and ongoing kickoff corrections.
- **Odds/final-score provider** supplies preliminary spreads, official-line
  inputs, and verified final scores.
- **Brevo** delivers reminders, reveals, recaps, and actionable watchdog email.
- **GitHub Actions** runs application quality, database migration workflows,
  isolated lifecycle checks, encrypted backups, and monthly upgrade rehearsals.

## Player identity and privacy

- Players authenticate with their assigned pool identity and PIN/session flow.
- Concurrent page and navigation startup share one in-flight session read. The
  result is not cached after completion, so sign-out and expiry remain immediate.
- Header identity and Commissioner access use the same authenticated profile
  route as the rest of the app. A temporary profile-read failure does not erase
  an already verified identity; an invalid session returns the player to PIN
  sign-in instead of leaving a half-signed-in page.
- PIN sign-in is routed through the application. Ten different invalid PINs
  from one privacy-safe source fingerprint in 15 minutes open a Commissioner
  incident and email alert. Successful login clears prior failures, no player
  is locked out by this alert, and raw PINs or network addresses are never
  retained in the security audit.
- A player can always see their own selections.
- Another player's selection remains hidden until that selected game's kickoff.
  Reveal is per game, not all-at-once for the week.
- Anonymous and ordinary authenticated clients cannot read private pick tables,
  playoff eligibility snapshots, service-only functions, or commissioner APIs.
- Commissioner routes use the shared commissioner gate. Scheduled mutation
  routes require the shared automation bearer secret.

## Pick'em selection and scoring

- Regular-season periods normally require two ATS picks.
- Playoff rounds use their configured slate sizes: Wild Card 6, Divisional 4,
  Conference Championships 2, and Super Bowl 1.
- A player may submit a full round at once. Each individual pick remains
  editable until its own kickoff, so earlier games can lock while later games
  remain changeable.
- The selected team must belong to the selected game. A kicked-off pick cannot
  be added, removed, or replaced.
- Picks use the saved official line. A cover is a win; an ATS push or tied
  pick'em game is a loss under the pool rule.
- A missing usable official line leaves the pick pending and blocks unsafe
  period completion.
- Standings count only explicitly graded ATS wins. Pending, loss, and void rows
  never become wins by inference.
- A final tie for the Pick'em lead creates co-champions; the system invents no
  tiebreaker.

## Survivor selection and scoring

- Every active player is enrolled when Survivor opens for the season.
- Survivor is regular-season only. An active player must make one straight-up
  selection per period and cannot reuse a team from a non-void prior pick.
- A selection can be changed or cleared until its game's kickoff.
- A straight-up win advances the player. A loss or tie eliminates the entry.
- Missing the required selection by the final eligible kickoff eliminates the
  active entry.
- A postponed, cancelled, or no-contest selection never advances Survivor.
  Voided selections do not consume the team and can be replaced while a legal
  future game remains. If a no-contest has no legal replacement left, the
  published settlement rule records the ATS selection as a loss and eliminates
  the Survivor entry.
- Survivor results never count toward season-long ATS wins or ATS percentage.

## Weekly lifecycle

All operational times below are `America/New_York` and therefore remain stable
across daylight-saving changes.

1. The next period becomes manually selectable at midnight on the next Eastern
   calendar day after the prior period's final result settles. If its slate is
   loaded, picks may be made immediately.
2. Preliminary schedule and spread refreshes run before games lock. Each game
   carries its own kickoff and line-lock timestamps; international games can
   therefore lock earlier without special commissioner action.
3. Official lines lock at their configured time. Picks remain editable until
   kickoff, not merely until the line locks.
4. Final-score eligibility begins three hours after kickoff. Automation polls
   only eligible unfinished games, imports verified finals, and grades ATS and
   Survivor atomically.
5. The major weekly recap becomes eligible Tuesday at 6:30 AM Eastern. It sends
   only after the week is trustworthy; a late result sends as soon as it settles
   rather than waiting another week.
6. The normal default-week handoff is Wednesday at 3:00 AM Eastern and at least
   24 hours after the prior week settled. If the next kickoff is less than 24
   hours away, the handoff may occur immediately when the prior week settles.
7. Default handoff never hides history. Every completed period remains
   available in the archive/week selector.

Period completion is fail-closed: a postponed/cancelled review, missing line,
pending grade, or other unresolved integrity condition prevents the automatic
handoff and surfaces a commissioner review instead.

## Playoff eligibility

Playoff competition uses cumulative season ATS wins and the remaining possible
playoff wins.

- At the beginning of each Eastern game day, the database creates one immutable
  eligibility snapshot for every active player.
- Wins from games on that same day do not change who may compete later that
  day. If a player could tie the leader at day start, every eligible game that
  day still counts for that player.
- A player is out only when `day-start wins + remaining possible wins` is less
  than the day-start leader's wins. Tying remains mathematically alive.
- Future playoff periods contribute no more wins than their real remaining
  schedule and configured pick limit allow.
- When a new day-start snapshot marks a player ineligible, their affected
  future pending picks are atomically changed to `void`. They are excluded from
  totals rather than left as losses.

## NFL schedule agility and gameweek integrity

### Preseason bootstrap

- The annual bootstrap creates the new preseason when needed, downloads the
  complete regular-season schedule, and accepts it only if all 272 games and
  all 18 weeks validate.
- A partial, malformed, duplicate, or structurally inconsistent schedule makes
  no database change and is retried later.
- Initial import assigns and permanently pins every game to its scoring period
  and original NFL gameweek.

### In-season reconciliation

- The canonical schedule is rechecked no more than once every four hours during
  normal operation.
- An unlocked, scheduled future game with the same provider id, teams, scoring
  period, and gameweek may receive a new kickoff and line-lock time. Its stale
  unfinalized official line is reopened so a fresh line can lock later.
- A postponed game may cross a calendar-week boundary while remaining in its
  original pool week.
- Changes to a locked, settled, disrupted, re-paired, or cross-period game are
  quarantined for commissioner review. Safe unrelated changes continue.
- A game omitted by the provider is reported but never deleted.
- Database triggers independently reject changes that would break gameweek or
  pick-to-game scoring-period consistency.

The schedule provider is canonical for game identity and timing. The odds feed
may enrich spreads but cannot override canonical schedule assignments.

## Disruptions and corrections

- A commissioner records a verified `postponed`, `cancelled`, or `no_contest`
  state through Game Exceptions. Provider refreshes never silently overwrite a
  final or disruption status.
- Pending affected ATS and Survivor picks become `void` atomically and receive
  append-only audit events. A legal unstarted replacement can be selected.
- A verified score correction uses the audited atomic correction function. It
  preserves void rows, regrades affected picks, and records league impact.
- Final-score reconciliation is read-only. It compares stored finals with the
  provider and flags discrepancies; it never edits scores or grades.
- Completed periods, games, official lines, picks, and audit history are frozen.
  Corrections are new audit events, never rewrites of original history.

## Season progression and annual rollover

- Season state follows scoring-period state: preseason before play,
  regular-season during regular periods, playoffs during playoff periods, and
  complete only after the final period settles.
- Closing a period and activating its successor is one atomic operation that
  leaves exactly one active period.
- On or after August 1 Eastern, the annual rollover is safe to retry. It returns
  the existing season if already created rather than duplicating it.
- The new season copies the prior season's ordered scoring-period template and
  configured pick limits. Every new period is `upcoming` with blank dates.
- Games, lines, picks, Survivor entries/picks, grades, scores, championships,
  player season results, and prior audit history are not copied.
- Old seasons remain queryable for personal records, archives, championships,
  and dispute resolution.
- Annual cleanup runs only after the prior season, every scoring period, game,
  pick grade, schedule review, and required championship is certified complete.
  A blocker is recorded and alerted; it never causes automation to guess.
- Certified cleanup removes only superseded pre-kickoff save snapshots,
  redundant preliminary spreads, expired worker/security state, and eligible
  180-day operational records. The final player save snapshot and every
  official game, line, pick, score, championship, and delivery receipt remain.
- The turnover creates missing active-player Survivor entries for the new
  season and stores one permanent kept/deleted-count receipt. Retrying returns
  that receipt without cleaning twice.

## Automation safety and efficiency

- Scheduled and commissioner-triggered mutation paths claim the same
  token-owned execution lease. A duplicate run exits instead of overlapping.
- Score polling backs off per unfinished game at 15 minutes, 30 minutes, one
  hour, two hours, then six hours.
- Low provider allowance reserves remaining credits for line integrity.
- Schedule-provider failures use a circuit breaker and shared cooldown. Manual
  commissioner override may bypass timing, but not authentication, leases,
  quota reserve, pins, or atomic validation.
- Mutations are idempotent or retry-safe. Imports validate before writing;
  rollover returns the existing result; line locking and scoring operate only
  on due records.
- Operational logs and delivery receipts are retained and reviewed separately
  from permanent competitive history.
- Once per Eastern day, the leased watchdog reuses Launch Preflight's
  zero-credit external checks for cron authorization, Odds access, the active
  Brevo sender, and a Commissioner alert address. A failed daily check retries
  no more than hourly and becomes one deduplicated configuration incident.
- A weekly storage guardrail runs through the protected Monday watchdog and
  removes only routine `sync_runs` plus resolved watchdog and schedule-review
  incidents after 180 days. The certified annual cleanup may additionally
  remove superseded pre-kickoff save snapshots and redundant preliminary
  spreads from the completed season. Final save snapshots, picks, final scores,
  official lines, championships, and email receipts are never part of cleanup.
  During the live season, repeated unchanged preliminary spreads are stored at
  most once per Eastern day.
- Players choose one of three email plans: **Essentials**, **Regular**, or
  **Full Card**. Each remains individually adjustable in Notifications; existing
  choices are never changed just because the plan labels evolve.
- Final gameday lines use one explicit choice: every gameday, Sundays only, or
  none. Selection reminders use three independent choices: Sunday 11:00 AM,
  Sunday 3:00 PM, and the combined Sunday 6:00 PM/Monday 5:00 PM primetime set.
  All times are Eastern, and a reminder sends only while that player can still
  make a needed selection.
- Those plans are operational schedules, not just presets. The reminder worker
  queues each promised occurrence from the live NFL schedule, safely replaces
  unsent occurrences after a flex or cancellation, and preserves sent wording
  plus the exact source-game receipt.
- Public-pick emails are scoped to their kickoff window and are intentionally
  suppressed when nobody selected a represented game. Playoff reveals normally
  become one message per game because playoff kickoff times rarely match.
- Wednesday Slate and Tuesday recap subjects include the scoring-period name.
  Playoff reveal and day-recap subjects include the represented Eastern game
  date. After Survivor concludes, weekly recaps automatically use Pick'em-only
  wording; the championship-week recap may still memorialize the champion.
- At most one routine pool email is delivered to a player in an Eastern
  calendar day. Pick-due reminders and material early-lock/schedule notices
  bypass that limit. A held routine email is retained as a receipt, not counted
  as a delivery failure, and is visible to the Commissioner.

## Action-only watchdog

The watchdog evaluates frequently but opens one incident and sends one alert
only when commissioner action is likely required:

- a game passed line lock without an official line;
- final scores are due and the score worker is failed or stale for 45 minutes;
- a scheduled pool message is overdue or stuck sending;
- the full schedule is still incomplete after August 15; or
- a required production cron/preflight condition is missing.

Individual bad email addresses and intentional provider cooldowns do not alert.
An incident resolves automatically after recovery and may alert again only if
the condition genuinely recurs.

## Commissioner controls

The Commissioner area is the operational control plane. Its intended order is:

1. Read the quiet watchdog and Automation Health.
2. Run Season Readiness, Opening Week Checklist, Automation Preflight, or the
   read-only Integrity Rehearsal as appropriate.
3. Let scheduled automation run normally.
4. Use the matching manual line, score, schedule, reminder, or watchdog control
   once when recovery is required.
5. Use final-score reconciliation or Game Exceptions for verified anomalies.
6. Use Season Recovery Rehearsal before a rare lifecycle recovery.

The Reminders view is an action queue, not a health score: it plainly lists
automatic messages, items needing attention, empty reveal windows intentionally
suppressed, and routine emails held for inbox space. The Commissioner may edit
standard future wording but cannot create an ad-hoc scheduled pool blast. The
built-in email test sends only to the signed-in Commissioner's opted-in address,
never the player pool.

Manual controls are recovery paths, not alternate implementations.

## Environments and deployment

- **Production** contains the real league. Never seed it or run destructive
  tests against it.
- **isolated-test** contains disposable fixtures and mirrors migrations. The
  exact confirmation value `isolated` is required before integration work.
- Application changes pass tests, lint, build, GitHub quality checks, and a
  Vercel preview before merge.
- Database changes are new timestamped migrations. The production migration
  workflow dry-runs before applying them; the isolated project receives them
  first for lifecycle-sensitive work.
- Full-season certification covers 18 regular weeks, four playoff rounds, 285
  games, schedule changes, disruptions, scoring, eligibility, privacy,
  Survivor, archives, and annual rollover.
- The scheduled Wednesday isolated workflow also rehearses one realistic live
  week: revised ATS and Survivor saves, final grading, historical retention,
  and an atomic next-week handoff. Its transaction is always rolled back.
- The monthly upgrade rehearsal updates dependencies only inside the isolated
  job, applies every migration, runs the lifecycle drill, lints, and builds. It
  never commits upgrades or deploys production.

## Documentation maintenance contract

Any change to a pool rule, lifecycle time, provider policy, privacy boundary,
manual control, database invariant, or deployment gate must update all three in
the same pull request:

1. the executable test demonstrating the new rule;
2. this project reference and the affected runbook; and
3. `docs/DECISION_LOG.md`, including the reason and superseded rule.

Use the [SOP index](SOP_INDEX.md) to find the correct operational procedure.
