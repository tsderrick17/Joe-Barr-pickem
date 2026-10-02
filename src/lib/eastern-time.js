/**
 * The pool runs on NFL (Eastern) time. Every date and clock calculation reads
 * Eastern wall-clock parts through this one module, so week rollover, line
 * locks, reminders, and recaps can never disagree about what day or hour it is.
 */
export const EASTERN_TIME_ZONE = "America/New_York";

// One formatter, built once. hourCycle "h23" keeps midnight as 0 (never 24).
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Eastern wall-clock parts for an instant (a Date or anything Date accepts).
 * `weekday` is the full name ("Monday"); `weekdayShort` is "Mon".
 */
export function easternParts(value) {
  const parts = partsFormatter.formatToParts(value instanceof Date ? value : new Date(value));
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday");
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday,
    weekdayShort: weekday.slice(0, 3),
  };
}

/** The Eastern calendar date as "YYYY-MM-DD". */
export function easternDateKey(value) {
  const { year, month, day } = easternParts(value);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The Eastern hour, 0-23. */
export function easternHour(value) {
  return easternParts(value).hour;
}

/** The Eastern weekday's full name, such as "Sunday". */
export function easternWeekday(value) {
  return easternParts(value).weekday;
}

/** The UTC instant for an Eastern wall-clock time (daylight saving included). */
export function easternDateTimeToUtc(year, month, day, hour, minute = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const eastern = easternParts(utcGuess);
  const offset = Date.UTC(eastern.year, eastern.month - 1, eastern.day, eastern.hour, eastern.minute) - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}
