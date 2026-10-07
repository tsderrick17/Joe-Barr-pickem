// @ts-check
import { easternDateTimeToUtc } from "./schedule-time.js";
import { easternDateKey as easternDate } from "./eastern-time.js";

/** @param {string} day - Eastern calendar date in YYYY-MM-DD format. @returns {string} */
export function bowlDailyRecapAt(day) {
  const [year, month, date] = day.split("-").map(Number);
  return easternDateTimeToUtc(year, month, date + 1, 5).toISOString();
}

/** @param {Array<{ kickoff_at: string }>} games @returns {string[]} Eastern calendar dates, sorted ascending. */
export function bowlGamedays(games) {
  return [...new Set(games.map((game) => easternDate(new Date(game.kickoff_at))))].sort();
}

/** @param {string} kickoffAt @returns {string} ISO timestamp three hours before kickoff. */
export function unpickedBowlReminderAt(kickoffAt) {
  return new Date(new Date(kickoffAt).getTime() - 3 * 60 * 60 * 1000).toISOString();
}
