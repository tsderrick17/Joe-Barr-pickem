# Standard operating procedure index

This page routes a commissioner or future coding session to the correct
procedure. Scheduled automation is the normal operator. Manual actions are
guarded recovery tools for a specific observed condition.

## Routine calendar

| When | Expected automatic behavior | Human check |
| --- | --- | --- |
| Preseason | Create the new preseason, validate 272 games, import and pin 18 regular weeks | Review Season Readiness and bootstrap status |
| Before the first lock | Refresh schedule/spreads and prepare due official lines | Run Opening Week Checklist and Launch Preflight; confirm both UptimeRobot monitors are green |
| At each line lock | Save the official spread for the due game | Act only if health or watchdog reports a missing line |
| Three hours after kickoff onward | Poll eligible unfinished games and grade verified finals | Avoid repeated manual polling |
| Daily | Recheck cron authorization, Odds access, Brevo sender, and Commissioner alert delivery configuration | Act only if the watchdog opens one drift incident |
| Tuesday, 6:30 AM Eastern | Send the weekly recap once all results are trustworthy | Check reminder health if the recap is late |
| Wednesday, 3:00 AM Eastern | Default to the next usable week after the 24-hour display minimum | Confirm the prior week remains available |
| Wednesday | Rehearse one complete save, revision, scoring, and week-handoff cycle in isolated-test | Review only a failed workflow |
| Weekly | Export, encrypt, restore-check, and retain a database backup | Review only a failed workflow or backup-health alert |
| Monthly | Run isolated dependency/migration/lifecycle rehearsal | Review the artifact if it fails |
| August 1 onward | Create the next blank season, certify the prior season, run guarded annual cleanup once, then import the complete schedule | Review Schedule only if turnover lists a blocker or bootstrap remains incomplete |

## Choose the right procedure

### Normal weekly operation

Use [GAME_DAY_RUNBOOK.md](GAME_DAY_RUNBOOK.md). It covers readiness, line lock,
score sync, recap, default-week handoff, and the safest recovery order.

### A score is late, wrong, or disagrees with the provider

Use **Commissioner Desk → Final Score Check** once after the three-hour window.
If a saved final disagrees with the provider, run **Final Score Reconciliation**
and follow the audited correction procedure in
[commissioner-runbook.md](commissioner-runbook.md). Never type an estimated
score or repeatedly poll a failing provider.

### A kickoff moves or a game is postponed, cancelled, or no contest

Let normal schedule reconciliation apply an unlocked timing-only correction.
If the change is quarantined or the NFL officially disrupts the game, use
**Commissioner Desk → Game Exceptions** and follow the disruption section in
[commissioner-runbook.md](commissioner-runbook.md).

### An official line is missing

Check Automation Health and the watchdog incident. Use **Check official spread
locks** once. Preserve a line that already locked; do not substitute a later
market line after the deadline.

### The new season or full schedule is not ready

Read the **Schedule** panel and run **Run automatic check now**. If the provider
still validates a complete schedule but automation cannot finish, use the
preview-first full-schedule recovery controls. See the automatic handoff section
of [OPERATIONS.md](OPERATIONS.md).

### A weekly or annual transition appears stuck

Run the read-only Season Readiness and Integrity Rehearsal first. Confirm every
game and applicable pick is settled. Use **Season Recovery Rehearsal** before
any corrective action. Never force a status past a pending line, grade, or
disruption review.

### Automation or provider calls keep failing

Read the quiet watchdog incident and Automation Health. Respect the displayed
cooldown. Emergency controls can bypass cooldown timing only; they retain the
lease, quota, pin, and atomic safeguards. See [OPERATIONS.md](OPERATIONS.md).

### Reminder or recap delivery is late

Open **Commissioner → Reminders**, check the scheduled delivery and provider
receipt, and send only the safe test email when diagnosing configuration. The
Tuesday recap waits for accurate results, so first distinguish an unsettled
week from a delivery failure. A receipt marked **held** means the routine
one-email-per-Eastern-day limit intentionally protected that player's inbox;
it is not a failed delivery. Pick-due and material early-lock notices bypass
that routine limit.

Automatic selection reminders are grouped into three player choices: Sunday
11:00 AM, Sunday 3:00 PM, and Sunday 6:00 PM plus Monday 5:00 PM. Empty public
reveal windows appear as intentionally suppressed and require no action. The
Reminders page edits future standard wording and shows receipts; it does not
create one-off scheduled pool messages or alter the automatic timetable.

### A deployment changes database behavior

Follow [supabase-github-cutover.md](supabase-github-cutover.md). Add a new
timestamped migration, apply it to isolated-test, run the relevant database and
lifecycle tests, dry-run production, then apply through the guarded workflow.

### A release or dependency upgrade is risky

Use [isolated-integration-tests.md](isolated-integration-tests.md) for the
full-season drill and [OPERATIONS.md](OPERATIONS.md) for the monthly upgrade
rehearsal. Never turn a rehearsal result into an automatic production upgrade.

### The site is unavailable

Check the public health endpoint and hosting/database status. Follow
[uptime-monitoring.md](uptime-monitoring.md). Availability alerts and pool
integrity alerts are intentionally separate.

### The site works but automation heartbeat is down

Open UptimeRobot's **PickemJB automation heartbeat** incident, then check
Commissioner Automation Health and the watchdog receipt. A non-200 response at
`/api/health/automation` means the five-minute watchdog has failed or has not
completed successfully within 12 minutes; it does not mean the player-facing
site itself is unavailable.

### The critical-worker heartbeat is down

Open UptimeRobot's **PickemJB critical workers** incident, then open
Commissioner Automation Health. The public endpoint intentionally does not name
the failing worker. The Commissioner view distinguishes a stale or failed line
lock, score refresh, or reminder pass. Recover only the named worker; do not
manually run every job.

### The encrypted-backup health monitor is down

Open GitHub Actions → **Encrypted database backup**. The health endpoint is
green only when the latest completed run succeeded recently; that workflow
uploads its artifact only after the decrypt-and-restore check. Correct the
reported failure, then rerun that workflow once.

### A backup or disaster recovery is required

Follow the backup section of [OPERATIONS.md](OPERATIONS.md). Restore into an
isolated project first, preserve the current audit trail, and treat production
restore as a last resort.

## Escalation rule

Stop automation or request manual review only when the system identifies an
integrity condition it cannot safely resolve. A late provider response,
intentional cooldown, or single bad recipient is normally a wait/retry state,
not an emergency.
