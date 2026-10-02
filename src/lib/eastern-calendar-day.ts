import { easternParts } from "@/lib/eastern-time.js";
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
