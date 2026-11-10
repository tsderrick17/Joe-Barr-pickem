import { easternDateKey } from "./eastern-time.js";

/**
 * The Pick'em Pad dresses up for three holidays: Halloween, Thanksgiving Day, and Christmas Day. A holiday belongs
 * to the pool week whose games are its holiday weekend. From Thursday through Monday that is the week the holiday
 * falls in. A holiday on a Tuesday or Wednesday comes before its own week's games, so it belongs to the week before,
 * and the skin then stays up through the holiday itself. Every other week wears the usual pad. Only the look
 * changes; the pad shows the same rows, picks, lines, and results.
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
 * The holiday skin for a pool week at a moment in time, or null. A week runs from its starts_at (a Tuesday at
 * midnight Eastern) up to its ends_at (the next Tuesday at midnight), so its Eastern days are Tuesday through
 * Monday. A week without dates, or a playoff round, wears no skin.
 * @param {{ starts_at?: string | null, ends_at?: string | null, period_type?: string | null }} week
 * @param {Date | string | number} now
 * @returns {PadSkin | null}
 */
export function padSkinForWeek(week, now) {
  if (!week.starts_at || !week.ends_at || week.period_type === "playoff") return null;
  const firstDay = easternDateKey(week.starts_at);
  const lastDay = easternDateKey(new Date(Date.parse(week.ends_at) - 1));
  if (lastDay < firstDay) return null;
  const inWeek = (/** @type {string} */ day) => day >= firstDay && day <= lastDay;
  const today = easternDateKey(now);
  const years = new Set([Number(firstDay.slice(0, 4)), Number(lastDay.slice(0, 4))]);
  for (const year of years) {
    for (const [skin, day] of holidays(year)) {
      // Days since the Tuesday that opens the holiday's own week: 0 on a Tuesday, 1 on a Wednesday.
      const daysIntoWeek = (new Date(`${day}T00:00:00Z`).getUTCDay() + 5) % 7;
      if (daysIntoWeek > 1) {
        if (inWeek(day)) return skin;
      } else if (inWeek(shiftDay(day, -daysIntoWeek - 1)) || (inWeek(day) && today <= day)) {
        return skin;
      }
    }
  }
  return null;
}
