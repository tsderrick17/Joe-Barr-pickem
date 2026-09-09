import { easternDateTimeToUtc } from "./schedule-time.js";
const EASTERN = "America/New_York";

function easternDate(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

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
