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
4. Treat automatic full-schedule bootstrap and reconciliation as the primary
   schedule path. Use preview/import controls only for a diagnosed recovery;
   they retain the same validation and gameweek pins.

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
  app recalculates affected grades atomically and posts a week-specific
  league-impact notice.
- **Postponed or cancelled / declared no contest:** record the verified game
  exception. Eligible future selections stay changeable; a pick that cannot be
  replaced settles as the published pool rule requires. Survivor does not
  advance on a no contest.
- **Moved kickoff:** allow canonical schedule reconciliation to apply an
  unlocked timing-only move. The new lock time governs availability;
  previously selected eligible picks remain attached and may be changed while
  still open. A locked, settled, re-paired, or cross-period change is
  quarantined for commissioner review instead of being forced through.

## Weekly close

1. Check Automation Health after the final game grades.
2. The major recap becomes eligible Tuesday at 8:00 AM Eastern and sends once
   every result is trustworthy. If it is late, distinguish an unsettled week
   from a reminder-delivery failure before intervening.
3. The next period is manually selectable on the next Eastern day when its
   slate is loaded. The default view normally changes Wednesday at 3:00 AM
   Eastern and at least 24 hours after settlement, unless the next kickoff is
   less than 24 hours away.
4. Confirm the completed week remains available in the archive/week selector;
   changing the default never hides historical weeks.

The live operations map shows this as a separate **Week handoff** gate during
the regular season. In the playoffs it becomes **Round handoff** or **Season
finish**. A red gate identifies the exact final, grade, timestamp, or disruption
holding the transition; never force the next period past that gate.

## Player email rhythm

- Selection reminders run Sunday at 11:00 AM, 3:00 PM, and 6:00 PM Eastern,
  then Monday at 5:00 PM Eastern. Players control the first two individually;
  Sunday and Monday primetime share one choice.
- A reminder is sent only when the player still owes a selection and a legal
  unstarted game remains.
- Public-pick updates send only after the represented kickoff and only when at
  least one player selected one of those games. An empty window is recorded as
  suppressed rather than retried.
- Tuesday recap subjects name the completed week, Wednesday Slate subjects name
  the incoming week, and playoff updates name the represented game date.

## Recovery

The weekly encrypted database backup is a last resort. It retains 90 days of
encrypted exports. Do not restore a backup to diagnose an ordinary late score;
use the audit controls first. For a genuine recovery, pause edits, preserve the
current audit record, and restore only into a test project before considering a
production recovery.
