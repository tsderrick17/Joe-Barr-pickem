/** How long after kickoff a game may go without a final score before it counts as overdue. A normal game, even with a weather delay, is over well before this. */
export const FINAL_OVERDUE_HOURS = 6;

/**
 * Whether a game should have a final score by now and does not: it is still scheduled or live more than FINAL_OVERDUE_HOURS after kickoff.
 * One rule for both pools (NFL and Bowl), so the Commissioner's alert and the Bowl Card's "Final score pending" always agree.
 * @param {{ status: string, kickoff_at: string }} game
 * @param {Date} [now]
 */
export function finalIsOverdue(game, now = new Date()) {
  if (game.status !== "scheduled" && game.status !== "live") return false;
  const kickoff = Date.parse(game.kickoff_at);
  return Number.isFinite(kickoff) && now.getTime() - kickoff >= FINAL_OVERDUE_HOURS * 3_600_000;
}
