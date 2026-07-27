/**
 * Grades one ATS pick. A zero adjusted margin is a push, and pool rules
 * intentionally record pushes as losses.
 */
export function gradeAtsPick({
  selectedTeamId,
  favoriteTeamId,
  lockedSpread,
  awayTeamId,
  homeTeamId,
  awayScore,
  homeScore,
}) {
  if (
    !favoriteTeamId ||
    !Number.isFinite(lockedSpread) ||
    !Number.isInteger(awayScore) ||
    !Number.isInteger(homeScore)
  ) {
    return "pending";
  }

  if (selectedTeamId !== awayTeamId && selectedTeamId !== homeTeamId) {
    return "pending";
  }

  const selectedScore =
    selectedTeamId === awayTeamId ? awayScore : homeScore;
  const opponentScore =
    selectedTeamId === awayTeamId ? homeScore : awayScore;

  const adjustedMargin =
    selectedTeamId === favoriteTeamId
      ? selectedScore - opponentScore - lockedSpread
      : selectedScore - opponentScore + lockedSpread;

  // A push (adjustedMargin === 0) is a loss under this pool's rules.
  return adjustedMargin > 0 ? "win" : "loss";
}
