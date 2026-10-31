export const FIRST_SCORE_CHECK_DELAY_MINUTES = 170;

/**
 * Polling for a game's final stops this long after kickoff: the paid provider no longer returns a game older than its three-day look-back, so
 * every further check would spend credits for nothing. A game still unfinished then is raised to the Commissioner as overdue instead (see final-overdue.js).
 */
export const FINAL_SCORE_POLLING_LIMIT_HOURS = 72;

/**
 * @param {{ kickoffAt: string, status: string }} game
 * @param {Date} [now]
 */
export function isDueForFinalScoreCheck({ kickoffAt, status }, now = new Date()) {
  if (status !== "scheduled" && status !== "live") return false;

  const kickoff = new Date(kickoffAt);
  const firstCheckAt = new Date(kickoff.getTime() + FIRST_SCORE_CHECK_DELAY_MINUTES * 60 * 1000);
  const lastCheckAt = new Date(kickoff.getTime() + FINAL_SCORE_POLLING_LIMIT_HOURS * 60 * 60 * 1000);

  return now >= firstCheckAt && now < lastCheckAt;
}
