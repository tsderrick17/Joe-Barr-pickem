# Uptime monitoring

UptimeRobot is an independent alarm system. The app owns five public, opaque
health contracts; additional page monitors are useful but do not replace them.
The live monitor count is shown under **Commissioner → Connected systems**,
while UptimeRobot remains the source of truth for exact monitor names, URLs,
contacts, and current incidents.

## Required health monitors

| Monitor | URL | A 200 proves | Where to diagnose a failure |
| --- | --- | --- | --- |
| PickemJB production | `https://pickemjb.vercel.app/api/health` | The deployment can reach the production database with both player-facing and server authorization | Vercel deployment/logs, then Supabase status |
| PickemJB automation heartbeat | `https://pickemjb.vercel.app/api/health/automation` | An authenticated, leased watchdog invocation recorded a durable run receipt within the last 20 minutes | **Commissioner → Automation Health** and the watchdog worker heartbeat |
| PickemJB critical workers | `https://pickemjb.vercel.app/api/health/workers` | Line locking (once a lock is due), reminder processing, and final-score processing are within their allowed freshness windows (with room for one delayed cron delivery) | **Commissioner → Automation Health** to identify the worker |
| PickemJB encrypted backup | `https://pickemjb.vercel.app/api/health/backup` | The latest encrypted-backup workflow completed successfully and passed its restore check within eight days | GitHub Actions → **Encrypted database backup** |
| PickemJB Bowl Pool | `https://pickemjb.vercel.app/api/health/bowl-pool` | Bowl schedule, participation, grading, and Bowl Pool automation are available (and remains healthy with placeholders before launch) | **Commissioner → Automation Health** and Bowl Pool worker logs |

Use HTTP/S monitors at five-minute intervals and treat a non-200 response,
timeout, or missed heartbeat as down. Configure both outage and recovery
notifications. Keep the Commissioner alert destination current.

All five endpoints deliberately return only HTTP 200 or 503. They never expose
database names, worker details, GitHub details, application secrets, or player
information. Do not weaken that opacity to make an external status page more
descriptive.

The worker freshness windows include bounded cron-delivery grace: 12 minutes
for line locks, 45 minutes for score checks, and 20 minutes for reminders.
UptimeRobot probes every five minutes, so one delayed serverless invocation
does not flap the monitor; the watchdog still evaluates genuinely overdue work.

## What each monitor does not prove

- The production check proves core availability, not that every background job
  is progressing.
- The automation heartbeat proves the watchdog is running, not that all
  critical workers are healthy.
- The worker heartbeat proves recent execution, not that the provider has
  already published a late final. Before the first line-lock deadline of a
  slate, the line-lock heartbeat is intentionally not required.
- The backup heartbeat proves the latest completed export, encryption, and
  restore check; it does not replace a deliberate isolated restore rehearsal.
- The Bowl Pool heartbeat proves the Bowl Pool contract is available; before
  the launch gate it intentionally stays healthy with placeholder data.

This separation matters: one red monitor should identify the failed layer
without turning an ordinary provider delay into a whole-site outage.

## Incident sequence

1. Open the specific incident and record which URL is failing.
2. Confirm whether the production health monitor is also down.
3. Use the diagnosis location in the table; do not manually run every job.
4. Recover only the named layer through the guarded Commissioner or GitHub
   control.
5. Confirm the endpoint returns 200 and UptimeRobot records the recovery.
6. If multiple internal monitors fail together, check shared server
   authorization before changing schedules. A valid-looking website can still
   have stale automation credentials.

The GitHub **Production smoke gate** performs the same public checks immediately
after a successful Vercel production deployment. Its retry window avoids a
false alarm while the alias settles. If two or more contracts remain red, the
run labels the result as a likely shared deployment or authorization problem;
it does not imply that each worker independently broke.

The automation heartbeat uses a constant-size worker row that updates in place
as soon as an authenticated, leased watchdog call records its durable run
receipt. Later diagnostic failures are stored as failed watchdog runs and
actionable Commissioner incidents, but do not create a false liveness outage.
If the scheduler, authorization, lease, or database write is unavailable
before that receipt, the monitor still fails closed. TLS errors from a local
command-line client (such as Windows Schannel) are client environment failures,
not application health results; UptimeRobot remains the external TLS authority.
Monitor records do not consume Odds API credits or create growing pool-history
tables.
