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
    return { run: false, reason: "schedule-unavailable", date: today };
  }

  // The Action wakes during the opening ten days solely to find this month's
  // first non-gameday. Once that day has passed, a failed rehearsal must not
  // turn into a daily alert loop. Manual dispatch remains the deliberate retry
  // path, and the next month gets a fresh scheduled attempt.
  for (let candidateDay = 1; candidateDay <= day; candidateDay += 1) {
    const candidate = `${monthPrefix}${String(candidateDay).padStart(2, "0")}`;
    if (gameDates.has(candidate)) continue;
    if (candidate === today) {
      return { run: true, reason: "first-available-non-gameday", date: candidate };
    }
    return { run: false, reason: "first-non-gameday-already-passed", date: candidate };
  }

  return { run: false, reason: "nfl-gameday", date: today };
}
