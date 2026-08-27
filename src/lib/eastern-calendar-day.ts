function easternParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/New_York",
    year: "numeric",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { day: read("day"), hour: read("hour"), minute: read("minute"), month: read("month"), year: read("year") };
}

function easternWallTimeToIso(year: number, month: number, day: number) {
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, 0, 0);
  const observed = easternParts(new Date(wallTimeAsUtc));
  const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
  return new Date(wallTimeAsUtc - (observedAsUtc - wallTimeAsUtc)).toISOString();
}

export function easternCalendarDayWindow(now = new Date()) {
  const current = easternParts(now);
  const nextDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  return {
    start: easternWallTimeToIso(current.year, current.month, current.day),
    end: easternWallTimeToIso(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate()),
  };
}
