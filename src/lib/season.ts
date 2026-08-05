/**
 * NFL pool years turn over on August 1 in the league's canonical time zone.
 * This intentionally derives the active season at runtime so the application
 * does not require a source-code edit every summer.
 */
const EASTERN_TIME_ZONE = "America/New_York";

export function seasonYearAt(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = value("year");
  const month = value("month");

  return month >= 8 ? year : year - 1;
}

export const CURRENT_SEASON_YEAR = seasonYearAt();
export { EASTERN_TIME_ZONE };
