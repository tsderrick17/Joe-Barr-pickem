import { easternDateTimeToUtc } from "./schedule-time.js";
import { easternDateKey as easternDate } from "./eastern-time.js";

export function bowlDailyRecapAt(day) {
  const [year, month, date] = day.split("-").map(Number);
  return easternDateTimeToUtc(year, month, date + 1, 5).toISOString();
}

export function bowlGamedays(games) {
  return [...new Set(games.map((game) => easternDate(new Date(game.kickoff_at))))].sort();
}

export function unpickedBowlReminderAt(kickoffAt) {
  return new Date(new Date(kickoffAt).getTime() - 3 * 60 * 60 * 1000).toISOString();
}
