// @ts-check
/**
 * Grades one ATS pick. A zero adjusted margin is a push, and Pick'em rules
 * intentionally record pushes as losses.
 * @param {{
 *   selectedTeamId: string | null,
 *   favoriteTeamId: string | null,
 *   lockedSpread: number | null,
 *   awayTeamId: string,
 *   homeTeamId: string,
 *   awayScore: number | null,
 *   homeScore: number | null,
 * }} pick
 * @returns {"win" | "loss" | "pending"}
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
    typeof lockedSpread !== "number" ||
    !Number.isFinite(lockedSpread) ||
    typeof awayScore !== "number" ||
    !Number.isInteger(awayScore) ||
    typeof homeScore !== "number" ||
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

  // A push (adjustedMargin === 0) is a loss under Pick'em rules.
  return adjustedMargin > 0 ? "win" : "loss";
}
