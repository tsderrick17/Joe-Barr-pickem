const easternTimeZone = "America/New_York";

export function getEasternParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: easternTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"), month: value("month"), day: value("day"),
    hour: value("hour"), minute: value("minute"),
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
  };
}

function getEasternOffsetMilliseconds(date) {
  const eastern = getEasternParts(date);
  return Date.UTC(eastern.year, eastern.month - 1, eastern.day, eastern.hour, eastern.minute) - date.getTime();
}

export function easternDateTimeToUtc(year, month, day, hour, minute = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getEasternOffsetMilliseconds(utcGuess);
  return new Date(utcGuess.getTime() - offset);
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
