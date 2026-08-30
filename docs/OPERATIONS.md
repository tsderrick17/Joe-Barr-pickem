# Lead Pipe Locks operations

## Backup and retention

The weekly GitHub Action **Encrypted database backup** creates a complete
encrypted database export every Monday morning at 9:17 AM Eastern during
daylight time (8:17 AM during standard time). It retains the encrypted artifact
for 90 days.

Before enabling it, add one GitHub repository secret:

- `BACKUP_ENCRYPTION_KEY` — a unique, long passphrase stored somewhere safe
  outside GitHub.

The existing `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and
`SUPABASE_PROJECT_ID` secrets are reused. To test, open GitHub **Actions** →
**Encrypted database backup** → **Run workflow**. Do not download or decrypt a
backup unless recovery is genuinely required.

Retention policy: scoring, official picks, locks, seasons, championships, final
save receipts, and email receipts are never automatically deleted. A weekly
database-local guardrail removes only `sync_runs` and resolved
watchdog/schedule-review operational records after 180 days. At the certified
August 1 turnover, earlier pre-kickoff pick-save snapshots that a later save
replaced and redundant preliminary spread snapshots are removed; the final
snapshot and every official competition record remain. It never calls a
provider or needs an app secret. The Commissioner Connected systems section
includes a read-only per-table size breakdown for review.

## Provider allowance

Final-score checks use escalating cooldowns for a game that has not finalized:
15 minutes, 30 minutes, 1 hour, 2 hours, then every 6 hours. A low observed
Odds API balance reserves the remaining allowance for line integrity and is
shown as an Automation Health warning. Normal completed games still grade as
soon as the provider reports final scores.

## Automatic season handoff

The season handoff no longer depends on a commissioner loading the schedule.
Each day in August and September, the bootstrap job creates the new preseason
when needed, requests the full regular-season provider schedule, validates that
all 272 games are present, and imports the schedule atomically. A partial or
malformed provider response changes nothing and is retried the next day. Once
all 18 regular-season periods and 272 games are present, later runs become safe
no-ops.

The Commissioner **Schedule** panel shows the current handoff state and
retains both recovery paths:

- **Run automatic check now** repeats the normal guarded handoff immediately.
- The full-schedule preview/import controls allow a commissioner to inspect and
  run the provider import manually during an emergency.

Both automatic and manual imports use the same validation and atomic database
function, so the recovery path cannot bypass gameweek-pinning protections.

The first safe run on or after August 1 also certifies the prior season before
annual cleanup. It refuses cleanup while a period, game, grade, schedule review,
or championship remains unfinished. After certification it removes replaced
pre-kickoff save snapshots, redundant preliminary spreads, old score backoffs,
expired leases/circuit state/PIN-attempt records, and the existing 180-day
operational records. It creates any missing new-season Survivor entries and
stores one permanent receipt. Retries return that receipt without repeating
the cleanup. The Schedule panel shows either the certification or each exact
blocker, and the watchdog alerts only when review is required.

After the full schedule is loaded, the canonical 272-game provider is checked
throughout the season (at most once every four hours). It can move an unlocked
future kickoff and reopen only that game's unfinalized line. A postponed game
may cross a calendar-week boundary but remains pinned to its original scoring
period and gameweek. Changes involving a locked or settled game, different
teams, or a different scoring period are quarantined for commissioner review;
the rest of the schedule continues reconciling normally.

## Quiet operations watchdog

The watchdog evaluates operations every five minutes but sends email only when
commissioner action is likely required. It opens one incident per condition,
sends one notification for that incident, and automatically resolves the
incident after recovery. A resolved condition can alert again if it genuinely
recurs. Failed notification delivery is retried no more than every 30 minutes.

The only alert conditions are:

- a game has passed line lock without an official line;
- final scores are due and the score worker is failed or stale for 45 minutes;
- a scheduled pool message is overdue or stuck sending;
- the full season schedule is still incomplete after August 15; or
- the certified annual turnover is blocked by unfinished prior-season work; or
- a required production cron/preflight check is missing.

Individual bad email addresses and intentional low-provider-quota cooldowns do
not alert. Open incidents and a manual **Run watchdog now** control are visible
on the Commissioner overview.

Once per Eastern day, the same leased watchdog also rechecks the external
configuration that can drift without a deployment: the deployed cron secret,
the zero-credit Odds API authentication endpoint, the configured active Brevo
sender, and an active Commissioner alert address. A failed check retries no
more than hourly and uses the existing deduplicated configuration incident.
The check sends no pool email and consumes no Odds API credit.

An external UptimeRobot monitor must also check
`https://pickemjb.vercel.app/api/health/automation` every five minutes. The
endpoint returns 200 when the watchdog worker heartbeat succeeded within the
last 12 minutes, so a stopped worker cannot silently report itself as healthy.
Heavy diagnostic failures are reported separately in Commissioner → Automation
Health and do not poison this liveness signal. This monitor is separate from
the existing public-site monitor.

The third required UptimeRobot monitor must check
`https://pickemjb.vercel.app/api/health/workers` every five minutes. It confirms
recent successful line-lock, reminder, and final-score worker executions using
three fixed-size heartbeat rows. Public responses stay opaque; use Automation
Health to identify the affected worker.

The fourth required free HTTP monitor must check
`https://pickemjb.vercel.app/api/health/backup` every five minutes. The endpoint
uses the existing server-only GitHub read token to inspect the latest completed
encrypted-backup workflow and returns 200 only for a recent success. It does
not expose GitHub details or require UptimeRobot's paid push-heartbeat feature.

## Reproducible critical schedules and launch preflight

Migration `20260818013000_rebuild_critical_automation.sql` is the canonical,
idempotent definition for the three game-critical workflows: official line
locking every minute, final-score refresh every 15 minutes, and the two
daylight/standard-safe pre-lock spread refresh windows. It replaces any older
jobs with those names, then recreates the expected definitions.

Before opening Week 1—and after any deployment or secret rotation—run
**Commissioner → Launch preflight**. It reads rather than mutates. A passing
result proves the full cron definitions and Vault authorization, the deployed
cron secret matches Vault, the zero-credit Odds API authentication check can
see the NFL feed, Brevo can list an active configured PickemJB sender, and at
least one active Commissioner has a valid alert address. The same checks are
included in the Opening Week checklist. Launch Preflight also names the
selected Supabase server credential variable without exposing its value and
holds production in attention if only the compatibility fallback is active.

## Release validation and correlated failures

Pull requests run an isolated Chromium player flow in addition to the database
lifecycle rehearsal. The browser creates a disposable commissioner, signs in
with the real PIN path, reloads the saved session, verifies all account
controls, simulates one temporary profile failure, saves ATS and Survivor
picks, revises Survivor, and removes every fixture afterward. The harness
refuses the production Supabase project before making a request.

After Vercel reports a successful Production deployment, GitHub Actions retries
the canonical page and all four public health contracts for up to two minutes.
This proves the deployed environment—not merely the preview build—can use its
real dependencies. The manual workflow is also safe to run after a secret
rotation.

If several health contracts fail in the same smoke pass, treat them as one
likely shared-dependency incident. Check the deployment and Supabase server
authorization before changing individual schedules. The failed smoke output
lists only URLs and status codes; it never prints response bodies or secrets.

## Monthly upgrade rehearsal

During the first ten Eastern calendar days of each month, GitHub Actions checks
the canonical NFL schedule and runs on the first day that has no NFL game. The
calendar check includes preseason, regular-season, and playoff dates, makes no
Odds API request, and fails closed when the schedule feed lacks coverage for an
active football month. A successful completion marker prevents another
scheduled run that month; a failed attempt may retry on a later non-gameday.
Manual rehearsals remain available at any time.

The selected run builds an isolated database, installs the latest direct package
versions without committing them, applies all migrations, runs the deterministic
full-season lifecycle drill, then runs lint and a production build. The rehearsal
does not deploy, alter production, or create player-site downtime. Moving it off
gamedays merely keeps optional CI load and failure alerts away from peak pool
usage. Its report is retained as a workflow artifact so an incompatible future
dependency is discovered before an urgent in-season upgrade.

## Weekly isolated live-week rehearsal

Every Wednesday, **Isolated integration checks** uses only the confirmed
isolated-test database to save and revise ATS and Survivor selections, finalize
a full slate, verify grades and preserved history, and perform the atomic
handoff to the next week. The rehearsal runs inside a database transaction and
always rolls it back, so it leaves no fixture records behind. It never calls
the Odds provider or Brevo and cannot run with production credentials.
