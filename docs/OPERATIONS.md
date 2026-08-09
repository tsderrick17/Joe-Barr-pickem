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

Retention policy: scoring, picks, locks, seasons, championships, and audit
history are never automatically deleted. Operational delivery records and sync
logs are kept while the Commissioner dashboard reports their age and volume;
they are reviewed before any archival deletion so a disputed season always has
its full record.

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

The Commissioner Desk **Schedule** panel shows the current handoff state and
retains both recovery paths:

- **Run automatic check now** repeats the normal guarded handoff immediately.
- The full-schedule preview/import controls allow a commissioner to inspect and
  run the provider import manually during an emergency.

Both automatic and manual imports use the same validation and atomic database
function, so the recovery path cannot bypass gameweek-pinning protections.

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
- a required production cron/preflight check is missing.

Individual bad email addresses and intentional low-provider-quota cooldowns do
not alert. Open incidents and a manual **Run watchdog now** control are visible
on the Commissioner Desk overview.

## Monthly upgrade rehearsal

On the first Monday of each month, GitHub Actions builds an isolated database,
installs the latest direct package versions without committing them, applies all
migrations, runs the deterministic full-season lifecycle drill, then runs lint
and a production build. This rehearsal does not deploy or alter production. Its
report is retained as a workflow artifact so an incompatible future dependency
is discovered before an urgent in-season upgrade.
