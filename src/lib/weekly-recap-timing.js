const timeZone = "America/New_York";

function easternParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(read("year")), month: Number(read("month")), day: Number(read("day")), weekday: read("weekday") };
}

function offsetMilliseconds(date) {
  const parts = easternParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day, Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date))) - date.getTime();
}

function easternToUtc(year, month, day, hour, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() - offsetMilliseconds(guess));
}

export function automaticWeeklyRecapAt(lastSettledAt) {
  const settled = new Date(lastSettledAt);
  const eastern = easternParts(settled);
  const date = new Date(Date.UTC(eastern.year, eastern.month - 1, eastern.day));
  const weekdayNumber = date.getUTCDay();
  // Sunday and Monday settle into the upcoming Tuesday. A delayed result on
  // Wednesday or later keeps this week's Tuesday boundary in the past so the
  // worker sends immediately once every score and grade is trustworthy.
  const daysToTuesday = 2 - weekdayNumber;
  date.setUTCDate(date.getUTCDate() + daysToTuesday);
  return easternToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 6, 30).toISOString();
}
