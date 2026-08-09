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

export function selectAvailableScoringPeriods(
  periods,
  { now, nextWeekAvailableAt },
) {
  const currentPeriod = selectDefaultScoringPeriod(periods);
  const nextPeriod = currentPeriod
    ? periods.find(
        (period) => period.display_order === currentPeriod.display_order + 1,
      )
    : null;
  const nextPeriodIsAvailable = Boolean(
    nextPeriod &&
      nextWeekAvailableAt !== null &&
      now >= nextWeekAvailableAt,
  );

  return periods.filter(
    (period) =>
      period.status === "complete" ||
      period.id === currentPeriod?.id ||
      (period.id === nextPeriod?.id && nextPeriodIsAvailable),
  );
}
