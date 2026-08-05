# Commissioner game-day runbook

This is the short, repeatable operating routine. Nothing here asks you to
change player picks or scores directly.

## Before the week opens

1. Open **Commissioner → Season Readiness**. Every regular-season item should
   be either **Ready** or **Later**. A red **Review** card tells you exactly
   what needs attention.
2. Open **Automation Health**. Confirm the most recent line lock and score
   sync are healthy. A low provider allowance is a warning, not a scoring
   change—the app automatically slows delayed-score polling to protect the
   remaining allowance.
3. Confirm the next slate has games, kickoff times, and official line-lock
   times. International games should show their earlier schedule naturally.

## Game day

1. Let the scheduled line lock run. The Slate turns official lines teal and
   exposes picks at kickoff without a commissioner action.
2. If an official line is unavailable at its scheduled lock, use the
   Commissioner line-lock review rather than changing game results. The audit
   trail records the outcome.
3. If a game ends late or is suspended, do not repeatedly run score sync. The
   system checks at a measured cadence and Automation Health will flag a truly
   overdue final.

## If a score, schedule, or result changes

- **Official correction:** use the existing score reconciliation/control. The
  app recalculates affected grades atomically and posts the league-impact
  notice.
- **Postponed or cancelled / declared no contest:** record the verified game
  exception. Eligible future selections stay changeable; a pick that cannot be
  replaced settles as the published pool rule requires. Survivor does not
  advance on a no contest.
- **Moved kickoff:** update the game schedule through the commissioner flow.
  The new lock time governs availability; previously selected eligible picks
  remain visible and may be changed while still open.

## Weekly close

1. Check Automation Health after the final game grades.
2. Confirm reminder delivery is healthy before relying on the weekly recap.
3. The Wednesday handoff presents the fresh slate once the next period has a
   usable schedule, while the completed week remains archived and auditable.

## Recovery

The weekly encrypted database backup is a last resort. It retains 90 days of
encrypted exports. Do not restore a backup to diagnose an ordinary late score;
use the audit controls first. For a genuine recovery, pause edits, preserve the
current audit record, and restore only into a test project before considering a
production recovery.
