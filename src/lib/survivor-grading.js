// @ts-check
/**
 * Survivor is straight up: the selected team must win the game outright.
 * A tie is intentionally a loss because each player must pick a winner.
 * @param {{
 *   selectedTeamId: string,
 *   awayTeamId: string,
 *   homeTeamId: string,
 *   awayScore: number | null,
 *   homeScore: number | null,
 * }} pick
 * @returns {"win" | "loss" | "pending"}
 */
export function gradeSurvivorPick({
  selectedTeamId,
  awayTeamId,
  homeTeamId,
  awayScore,
  homeScore,
}) {
  if (
    typeof awayScore !== "number" ||
    !Number.isInteger(awayScore) ||
    typeof homeScore !== "number" ||
    !Number.isInteger(homeScore) ||
    (selectedTeamId !== awayTeamId && selectedTeamId !== homeTeamId)
  ) {
    return "pending";
  }

  const selectedScore = selectedTeamId === awayTeamId ? awayScore : homeScore;
  const opponentScore = selectedTeamId === awayTeamId ? homeScore : awayScore;

  return selectedScore > opponentScore ? "win" : "loss";
}
