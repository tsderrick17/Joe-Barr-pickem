/**
 * The pool as it stood when a week ended, for the Big Board's look back: each player's wins added up through that week, not just that week's.
 * A pick is a win only once it is graded a win (a push is a loss, a voided pick is not counted), exactly as the Standings count them.
 */

/** @param {Array<{ player_id: string, result: string | null }>} picks every pick from the season's first week through the chosen week */
export function winTotals(picks) {
  /** @type {Record<string, number>} */
  const totals = {};
  for (const pick of picks) if (pick.result === "win") totals[pick.player_id] = (totals[pick.player_id] ?? 0) + 1;
  return totals;
}

/**
 * The weeks that count toward a snapshot of the chosen week: the regular season's weeks up to and including it.
 * @param {{ id: string, display_order: number, period_type: string }} chosen
 * @param {Array<{ id: string, display_order: number, period_type: string }>} periods the season's periods
 */
export function weeksThrough(chosen, periods) {
  return periods.filter((period) => period.period_type === "regular" && period.display_order <= chosen.display_order).map((period) => period.id);
}
