# Standard operating procedure index

This page routes a commissioner or future coding session to the correct
procedure. Scheduled automation is the normal operator. Manual actions are
guarded recovery tools for a specific observed condition.

## Routine calendar

| When | Expected automatic behavior | Human check |
| --- | --- | --- |
| Preseason | Create the new preseason, validate 272 games, import and pin 18 regular weeks | Review Season Readiness and bootstrap status |
| Before the first lock | Refresh schedule/spreads and prepare due official lines | Run Opening Week Checklist and Automation Preflight |
| At each line lock | Save the official spread for the due game | Act only if health or watchdog reports a missing line |
| Three hours after kickoff onward | Poll eligible unfinished games and grade verified finals | Avoid repeated manual polling |
| Tuesday, 8:00 AM Eastern | Send the weekly recap once all results are trustworthy | Check reminder health if the recap is late |
| Wednesday, 3:00 AM Eastern | Default to the next usable week after the 24-hour display minimum | Confirm the prior week remains available |
| Weekly | Create an encrypted database backup | Review failures only |
| Monthly | Run isolated dependency/migration/lifecycle rehearsal | Review the artifact if it fails |
| August 1 onward | Ensure the next annual season exists, retrying safely | Intervene only if bootstrap remains incomplete |

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

### A backup or disaster recovery is required

Follow the backup section of [OPERATIONS.md](OPERATIONS.md). Restore into an
isolated project first, preserve the current audit trail, and treat production
restore as a last resort.

## Escalation rule

Stop automation or request manual review only when the system identifies an
integrity condition it cannot safely resolve. A late provider response,
intentional cooldown, or single bad recipient is normally a wait/retry state,
not an emergency.
