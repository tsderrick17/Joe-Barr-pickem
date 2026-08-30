# Uptime monitoring

UptimeRobot is an independent alarm system. The app owns four public, opaque
health contracts; additional page monitors are useful but do not replace them.
The live monitor count is shown under **Commissioner → Connected systems**,
while UptimeRobot remains the source of truth for exact monitor names, URLs,
contacts, and current incidents.

## Required health monitors

| Monitor | URL | A 200 proves | Where to diagnose a failure |
| --- | --- | --- | --- |
| PickemJB production | `https://pickemjb.vercel.app/api/health` | The deployment can reach the production database with both player-facing and server authorization | Vercel deployment/logs, then Supabase status |
| PickemJB automation heartbeat | `https://pickemjb.vercel.app/api/health/automation` | The watchdog worker checked in successfully within the last 12 minutes | **Commissioner → Automation Health** and the watchdog worker heartbeat |
| PickemJB critical workers | `https://pickemjb.vercel.app/api/health/workers` | Line locking, reminder processing, and final-score processing are within their allowed freshness windows | **Commissioner → Automation Health** to identify the worker |
| PickemJB encrypted backup | `https://pickemjb.vercel.app/api/health/backup` | The latest encrypted-backup workflow completed successfully and passed its restore check recently | GitHub Actions → **Encrypted database backup** |

Use HTTP/S monitors at five-minute intervals and treat a non-200 response,
timeout, or missed heartbeat as down. Configure both outage and recovery
notifications. Keep the Commissioner alert destination current.

All four endpoints deliberately return only HTTP 200 or 503. They never expose
database names, worker details, GitHub details, application secrets, or player
information. Do not weaken that opacity to make an external status page more
descriptive.

## What each monitor does not prove

- The production check proves core availability, not that every background job
  is progressing.
- The automation heartbeat proves the watchdog is running, not that all
  critical workers are healthy.
- The worker heartbeat proves recent execution, not that the provider has
  already published a late final.
- The backup heartbeat proves the latest completed export, encryption, and
  restore check; it does not replace a deliberate isolated restore rehearsal.

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

The automation heartbeat uses a constant-size worker row that updates in place;
diagnostic run failures therefore cannot create a false liveness outage. TLS
errors from a local command-line client (such as Windows Schannel) are client
environment failures, not application health results; UptimeRobot remains the
external TLS authority. Monitor records do not consume Odds API credits or
create growing pool-history tables.
