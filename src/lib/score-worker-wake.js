import { easternDateTimeToUtc, easternParts } from "./eastern-time.js";

/**
 * When the score worker next has time-based work, so the database gate can wake it then instead of every ten minutes.
 * Finals are not part of this: the gate sees a game that is 170 minutes past kickoff and not final by itself. These
 * are the other duties of a run that fall due at a known time:
 *  - the weekly handoff, once the completed week has been kept visible until its handoff time;
 *  - Survivor no-pick eliminations, at the active week's final eligible kickoff;
 *  - the playoff eligibility snapshot, at the start of each Eastern day of an active playoff round;
 *  - opening the next week at its start, when no week is active.
 * Returns the earliest future time, or null (the gate's hourly safety run still comes).
 *
 * @param {{
 *   now: Date,
 *   weekRollover?: { action: string, rolloverAt: string | null } | null,
 *   activePeriod?: { periodType: string, finalKickoffAt: string | null } | null,
 *   upcomingStartsAt?: Array<string | null>,
 * }} input
 */
export function nextScoreWorkAt({ now, weekRollover = null, activePeriod = null, upcomingStartsAt = [] }) {
  const candidates = [];
  if (weekRollover?.action === "waiting" && weekRollover.rolloverAt) candidates.push(Date.parse(weekRollover.rolloverAt));
  if (activePeriod) {
    if (activePeriod.finalKickoffAt) candidates.push(Date.parse(activePeriod.finalKickoffAt));
    if (activePeriod.periodType === "playoff") candidates.push(nextEasternDayStart(now).getTime() + 60_000);
  } else {
    for (const startsAt of upcomingStartsAt) if (startsAt) candidates.push(Date.parse(startsAt));
  }
  const future = candidates.filter((time) => Number.isFinite(time) && time > now.getTime());
  return future.length ? new Date(Math.min(...future)).toISOString() : null;
}

/** @param {Date} now */
function nextEasternDayStart(now) {
  const today = easternParts(now);
  return easternDateTimeToUtc(today.year, today.month, today.day + 1, 0);
}
