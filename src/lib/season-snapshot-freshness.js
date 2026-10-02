/**
 * How long a finished Season Snapshot can be trusted before it could have
 * changed. The chart only changes when the active week's last pick settles (or
 * a week rolls over), so freshness follows the schedule instead of a timer:
 *  - before the active week's last kickoff it cannot settle, so it stays fresh
 *    until that kickoff (capped at an hour);
 *  - once every game has kicked off but grades are still landing, it is checked
 *    every couple of minutes, matching the score sync;
 *  - once the week has settled nothing is expected, so it is held for an hour.
 */
export const HOLD_MS = 60 * 60 * 1000;
export const WAITING_FOR_GRADES_MS = 2 * 60 * 1000;
export const CLOSED_CHART_MS = 5 * 60 * 1000;

export function snapshotFreshForMs(now, activeGameKickoffs, activeWeeksSettled, hasActiveWeek) {
  if (!hasActiveWeek) return HOLD_MS;
  const lastKickoff = Math.max(...activeGameKickoffs, Number.NEGATIVE_INFINITY);
  if (!Number.isFinite(lastKickoff)) return WAITING_FOR_GRADES_MS;
  if (now < lastKickoff) return Math.min(Math.max(lastKickoff - now, WAITING_FOR_GRADES_MS), HOLD_MS);
  return activeWeeksSettled ? HOLD_MS : WAITING_FOR_GRADES_MS;
}
