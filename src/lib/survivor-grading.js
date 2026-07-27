/**
 * Survivor is straight up: the selected team must win the game outright.
 * A tie is intentionally a loss because each player must pick a winner.
 */
export function gradeSurvivorPick({
  selectedTeamId,
  awayTeamId,
  homeTeamId,
  awayScore,
  homeScore,
}) {
  if (
    !Number.isInteger(awayScore) ||
    !Number.isInteger(homeScore) ||
    (selectedTeamId !== awayTeamId && selectedTeamId !== homeTeamId)
  ) {
    return "pending";
  }

  const selectedScore = selectedTeamId === awayTeamId ? awayScore : homeScore;
  const opponentScore = selectedTeamId === awayTeamId ? homeScore : awayScore;

  return selectedScore > opponentScore ? "win" : "loss";
}
