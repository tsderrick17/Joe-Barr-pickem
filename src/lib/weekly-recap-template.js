/**
 * Keep Survivor in the memorialized recap while the pool is genuinely alive,
 * and for the week in which its champion is crowned. Later recaps become
 * Pick'em-only instead of repeatedly describing a finished pool.
 *
 * @param {{ activeEntryCount: number, championCrownedInPeriod: boolean }} state
 */
export function weeklyRecapTemplateId(state) {
  return state.activeEntryCount > 1 || state.championCrownedInPeriod
    ? "weekly_recap"
    : "weekly_recap_pickem_only";
}
