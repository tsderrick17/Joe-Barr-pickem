import { easternParts } from "./eastern-time.js";

/** @param {Date} date */
function offsetMilliseconds(date) {
  const parts = easternParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - date.getTime();
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} [minute]
 */
function easternToUtc(year, month, day, hour, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() - offsetMilliseconds(guess));
}

/** @param {string} lastSettledAt */
export function automaticWeeklyRecapAt(lastSettledAt) {
  const settled = new Date(lastSettledAt);
  const eastern = easternParts(settled);
  const date = new Date(Date.UTC(eastern.year, eastern.month - 1, eastern.day));
  const weekdayNumber = date.getUTCDay();
  // Sunday and Monday settle into the upcoming Tuesday. A delayed result on
  // Wednesday or later keeps this week's Tuesday boundary in the past so the
  // worker sends immediately once every score and grade is trustworthy.
  const daysToTuesday = 2 - weekdayNumber;
  date.setUTCDate(date.getUTCDate() + daysToTuesday);
  return easternToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 6, 30).toISOString();
}
