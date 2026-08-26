const competitiveMonths = new Set([1, 2, 8, 9, 10, 11, 12]);

export function easternCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function selectUpgradeRehearsalDay({ eventName, today, gameDates }) {
  if (eventName === "workflow_dispatch") {
    return { run: true, reason: "manual", date: today };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match) throw new Error(`The rehearsal date is invalid: ${today}.`);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthPrefix = `${match[1]}-${match[2]}-`;

  if (day > 10) return { run: false, reason: "outside-opening-window", date: today };
  if (competitiveMonths.has(month) && ![...gameDates].some((date) => date.startsWith(monthPrefix))) {
    throw new Error(`The NFL schedule feed has no games for ${match[1]}-${match[2]}; the rehearsal will fail closed and retry.`);
  }
  if (gameDates.has(today)) return { run: false, reason: "nfl-gameday", date: today };
  return { run: true, reason: "first-available-non-gameday", date: today };
}
