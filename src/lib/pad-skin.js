import { easternDateKey } from "./eastern-time.js";

/**
 * The Pick'em Pad dresses up for three holidays: Halloween, Thanksgiving Day, and Christmas Day. The pool's week on
 * screen runs Wednesday through Tuesday (the default week advances early Wednesday), so a holiday dresses the pool
 * week that is on screen that day: a Thursday-through-Tuesday holiday dresses the week whose games it falls among or
 * just after, and a Wednesday holiday dresses the week that opens that morning. Every other week wears the usual
 * pad. Only the look changes; the pad shows the same rows, picks, lines, and results.
 */

/** @typedef {"halloween" | "thanksgiving" | "christmas"} PadSkin */

/** Thanksgiving Day, the fourth Thursday of November, as "YYYY-MM-DD". @param {number} year */
function thanksgivingDay(year) {
  const firstWeekday = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstThursday = 1 + ((4 - firstWeekday + 7) % 7);
  return `${year}-11-${String(firstThursday + 21).padStart(2, "0")}`;
}

/** @param {number} year @returns {Array<[PadSkin, string]>} */
function holidays(year) {
  return [["halloween", `${year}-10-31`], ["thanksgiving", thanksgivingDay(year)], ["christmas", `${year}-12-25`]];
}

/** A "YYYY-MM-DD" day moved by a number of days. @param {string} day @param {number} days */
function shiftDay(day, days) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The holiday skin for a pool week, or null. A week's dates run from its starts_at (a Tuesday at midnight Eastern)
 * up to its ends_at (the next Tuesday at midnight), and it is on screen one day later, Wednesday through Tuesday.
 * A week without dates, or a playoff round, wears no skin.
 * @param {{ starts_at?: string | null, ends_at?: string | null, period_type?: string | null }} week
 * @returns {PadSkin | null}
 */
export function padSkinForWeek(week) {
  if (!week.starts_at || !week.ends_at || week.period_type === "playoff") return null;
  const firstDay = easternDateKey(week.starts_at);
  const lastDay = easternDateKey(new Date(Date.parse(week.ends_at) - 1));
  if (lastDay < firstDay) return null;
  const years = new Set([Number(firstDay.slice(0, 4)), Number(lastDay.slice(0, 4)), Number(lastDay.slice(0, 4)) + 1]);
  for (const year of years) {
    for (const [skin, day] of holidays(year)) {
      // The week on screen on the holiday is the one whose Tuesday-to-Monday dates hold the day before it.
      const dayBefore = shiftDay(day, -1);
      if (dayBefore >= firstDay && dayBefore <= lastDay) return skin;
    }
  }
  return null;
}
