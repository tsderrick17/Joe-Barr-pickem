const easternTimeZone = "America/New_York";
const oneDayMilliseconds = 24 * 60 * 60 * 1000;

function getEasternParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: easternTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const value = (type) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
  };
}

function easternOffsetMilliseconds(date) {
  const eastern = getEasternParts(date);
  const easternClockReadAsUtc = Date.UTC(
    eastern.year,
    eastern.month - 1,
    eastern.day,
    eastern.hour,
  );

  return easternClockReadAsUtc - date.getTime();
}

function easternDateTimeToUtc(year, month, day, hour) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour));
  const offset = easternOffsetMilliseconds(utcGuess);

  return new Date(utcGuess.getTime() - offset);
}

export function normalWednesdayChangeoverAt(lastFinalizedAt) {
  const finalizedAt = new Date(lastFinalizedAt);
  const eastern = getEasternParts(finalizedAt);
  const easternDate = new Date(
    Date.UTC(eastern.year, eastern.month - 1, eastern.day),
  );
  const daysUntilWednesday = (3 - easternDate.getUTCDay() + 7) % 7;

  if (daysUntilWednesday === 0 && eastern.hour >= 3) {
    easternDate.setUTCDate(easternDate.getUTCDate() + 7);
  } else {
    easternDate.setUTCDate(easternDate.getUTCDate() + daysUntilWednesday);
  }

  return easternDateTimeToUtc(
    easternDate.getUTCFullYear(),
    easternDate.getUTCMonth() + 1,
    easternDate.getUTCDate(),
    3,
  ).toISOString();
}

export function weekRolloverAt({ lastFinalizedAt, nextKickoffAt }) {
  const finalizedAt = new Date(lastFinalizedAt);

  if (
    nextKickoffAt &&
    new Date(nextKickoffAt).getTime() - finalizedAt.getTime() <
      oneDayMilliseconds
  ) {
    return finalizedAt.toISOString();
  }

  const fullDayAt = new Date(finalizedAt.getTime() + oneDayMilliseconds);
  const normalChangeoverAt = new Date(
    normalWednesdayChangeoverAt(finalizedAt),
  );

  return new Date(
    Math.max(fullDayAt.getTime(), normalChangeoverAt.getTime()),
  ).toISOString();
}
