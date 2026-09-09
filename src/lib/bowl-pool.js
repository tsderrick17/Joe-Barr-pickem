import { easternDateTimeToUtc } from "./schedule-time.js";

export const BOWL_POOL_TIME_ZONE = "America/New_York";

/**
 * Return the canonical compact college label for Bowl cards.  The schedule
 * import supplies official abbreviations/short names; the initials fallback
 * keeps an unassigned or newly added school readable until that metadata is
 * available.  Callers should retain the full name in a title/aria-label.
 */
export function bowlTeamDisplayLabel(team) {
  if (!team) return "TBD";
  const abbreviation = typeof team.abbreviation === "string" ? team.abbreviation.trim() : "";
  if (abbreviation) return abbreviation.toUpperCase();
  const shortName = typeof team.short_name === "string" ? team.short_name.trim() : "";
  if (shortName) return shortName;
  const fullName = typeof team.full_name === "string" ? team.full_name.trim() : "";
  if (!fullName) return "TBD";
  const words = fullName.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.map((word) => word[0]).join("").slice(0, 4).toUpperCase() : fullName.slice(0, 4).toUpperCase();
}

/** December 7 at 3:00 AM Eastern. Commissioners bypass this player-facing gate. */
export function bowlPoolLaunchAt(seasonYear) {
  return easternDateTimeToUtc(seasonYear, 12, 7, 3).toISOString();
}

/**
 * Bowl-pool policy removes ATS pushes without changing a genuine PK game.
 * A whole-number line becomes the next half point; a half-point line is kept.
 */
export function normalizeBowlPoolSpread(spread) {
  if (!Number.isFinite(spread) || spread < 0) throw new Error("A bowl spread must be a non-negative number.");
  if (spread === 0) return 0;
  return Number.isInteger(spread) ? spread + 0.5 : spread;
}

export function gradeBowlPoolPick({
  selectedTeamId,
  favoriteTeamId,
  lockedSpread,
  awayTeamId,
  homeTeamId,
  awayScore,
  homeScore,
}) {
  if (!Number.isFinite(lockedSpread) || !Number.isInteger(awayScore) || !Number.isInteger(homeScore)) return "pending";
  if (selectedTeamId !== awayTeamId && selectedTeamId !== homeTeamId) return "pending";

  const selectedScore = selectedTeamId === awayTeamId ? awayScore : homeScore;
  const opponentScore = selectedTeamId === awayTeamId ? homeScore : awayScore;
  if (lockedSpread === 0) return selectedScore > opponentScore ? "win" : "loss";
  if (!favoriteTeamId) return "pending";

  const adjustedMargin = selectedTeamId === favoriteTeamId
    ? selectedScore - opponentScore - lockedSpread
    : selectedScore - opponentScore + lockedSpread;
  return adjustedMargin > 0 ? "win" : "loss";
}

/** Sort by ATS wins, then smallest absolute difference from the CFP final total. */
export function compareBowlPoolStandings(first, second, finalCombinedPoints = null) {
  if (first.wins !== second.wins) return second.wins - first.wins;
  if (!Number.isInteger(finalCombinedPoints)) return first.playerName.localeCompare(second.playerName);
  const firstDifference = Math.abs(first.tiebreakerTotal - finalCombinedPoints);
  const secondDifference = Math.abs(second.tiebreakerTotal - finalCombinedPoints);
  if (firstDifference !== secondDifference) return firstDifference - secondDifference;
  return first.playerName.localeCompare(second.playerName);
}
