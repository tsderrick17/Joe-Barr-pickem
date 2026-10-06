export const FIRST_SCORE_CHECK_DELAY_MINUTES = 170;

/**
 * @param {{ kickoffAt: string, status: string }} game
 * @param {Date} [now]
 */
export function isDueForFinalScoreCheck({ kickoffAt, status }, now = new Date()) {
  if (status !== "scheduled" && status !== "live") return false;

  const kickoff = new Date(kickoffAt);
  const firstCheckAt = new Date(kickoff.getTime() + FIRST_SCORE_CHECK_DELAY_MINUTES * 60 * 1000);

  return now >= firstCheckAt;
}
