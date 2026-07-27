/**
 * Selects the period players should land on: active first, then the next
 * upcoming period, then the most recently completed one after the season.
 */
export function selectDefaultScoringPeriod(periods) {
  const activePeriod = periods.find((period) => period.status === "active");
  if (activePeriod) return activePeriod;

  const upcomingPeriod = periods.find(
    (period) => period.status === "upcoming",
  );
  if (upcomingPeriod) return upcomingPeriod;

  const completedPeriods = periods.filter(
    (period) => period.status === "complete",
  );

  return completedPeriods.at(-1) ?? periods[0] ?? null;
}
