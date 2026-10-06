// @ts-check
import { easternDateTimeToUtc, easternParts as getEasternParts } from "./eastern-time.js";

const oneDayMilliseconds = 24 * 60 * 60 * 1000;

/** @param {string | Date} lastFinalizedAt */
export function normalWednesdayChangeoverAt(lastFinalizedAt) {
  const finalizedAt = new Date(lastFinalizedAt);
  const eastern = getEasternParts(finalizedAt);
  const easternDate = new Date(
    Date.UTC(eastern.year, eastern.month - 1, eastern.day),
  );
  const weekday = easternDate.getUTCDay();
  let daysToWednesday = 3 - weekday;

  // A result finalized after this week's Wednesday boundary falls back to the
  // separate 24-hour minimum; it must not postpone the handoff a whole week.
  easternDate.setUTCDate(easternDate.getUTCDate() + daysToWednesday);

  return easternDateTimeToUtc(
    easternDate.getUTCFullYear(),
    easternDate.getUTCMonth() + 1,
    easternDate.getUTCDate(),
    3,
  ).toISOString();
}

// The next Slate may be opened manually on the next Eastern calendar day,
// without changing which week players see by default.
/** @param {string} lastFinalizedAt */
export function nextWeekManualAccessAt(lastFinalizedAt) {
  const finalizedAt = new Date(lastFinalizedAt);
  const eastern = getEasternParts(finalizedAt);
  const nextEasternDate = new Date(
    Date.UTC(eastern.year, eastern.month - 1, eastern.day + 1),
  );

  return easternDateTimeToUtc(
    nextEasternDate.getUTCFullYear(),
    nextEasternDate.getUTCMonth() + 1,
    nextEasternDate.getUTCDate(),
    0,
  ).toISOString();
}

/** @param {{ lastFinalizedAt: string, nextKickoffAt: string | null }} rollover */
export function weekRolloverAt({ lastFinalizedAt, nextKickoffAt }) {
  const finalizedAt = new Date(lastFinalizedAt);

  if (
    nextKickoffAt &&
    new Date(nextKickoffAt).getTime() - finalizedAt.getTime() <
      oneDayMilliseconds
  ) {
    return finalizedAt.toISOString();
  }

  const fullDayAt = new Date(finalizedAt.getTime() + oneDayMilliseconds);
  const normalChangeoverAt = new Date(
    normalWednesdayChangeoverAt(finalizedAt),
  );

  return new Date(
    Math.max(fullDayAt.getTime(), normalChangeoverAt.getTime()),
  ).toISOString();
}
