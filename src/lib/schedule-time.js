import { easternDateTimeToUtc, easternParts } from "./eastern-time.js";

export { easternDateTimeToUtc };

/** Eastern parts with the short weekday name ("Mon") this module has always returned. */
export function getEasternParts(date) {
  const { year, month, day, hour, minute, weekdayShort } = easternParts(date);
  return { year, month, day, hour, minute, weekday: weekdayShort };
}

export function getWeekStartKey(kickoff) {
  const eastern = getEasternParts(kickoff);
  const date = new Date(Date.UTC(eastern.year, eastern.month - 1, eastern.day));
  const daysSinceTuesday = (date.getUTCDay() - 2 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceTuesday);
  return date.toISOString().slice(0, 10);
}

export function getWeekWindow(weekStartKey) {
  const [year, month, day] = weekStartKey.split("-").map(Number);
  const start = easternDateTimeToUtc(year, month, day, 0);
  const nextTuesday = new Date(Date.UTC(year, month - 1, day + 7));
  const end = easternDateTimeToUtc(nextTuesday.getUTCFullYear(), nextTuesday.getUTCMonth() + 1, nextTuesday.getUTCDate(), 0);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function getLineLock(kickoff) {
  const eastern = getEasternParts(kickoff);
  const isInternational = eastern.weekday === "Sun" && eastern.hour < 12;
  if (isInternational) {
    const priorDay = new Date(Date.UTC(eastern.year, eastern.month - 1, eastern.day - 1));
    return {
      isInternational: true,
      lineLockAt: easternDateTimeToUtc(priorDay.getUTCFullYear(), priorDay.getUTCMonth() + 1, priorDay.getUTCDate(), 18).toISOString(),
    };
  }
  return {
    isInternational: false,
    lineLockAt: easternDateTimeToUtc(eastern.year, eastern.month, eastern.day, 8).toISOString(),
  };
}
