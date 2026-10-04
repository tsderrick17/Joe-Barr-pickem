import { easternDateTimeToUtc } from "./schedule-time.js";

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

function normalizedBowlTeamLabel(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toUpperCase() : "";
}

/** Return compact labels for one matchup without allowing a same-game collision. */
export function bowlMatchupTeamLabels(first, second) {
  const firstBase = bowlTeamDisplayLabel(first);
  const secondBase = bowlTeamDisplayLabel(second);
  if (normalizedBowlTeamLabel(firstBase) !== normalizedBowlTeamLabel(secondBase)) return [firstBase, secondBase];

  const candidates = (team, base) => [
    base,
    typeof team?.short_name === "string" ? team.short_name.trim() : "",
    typeof team?.full_name === "string" ? team.full_name.trim() : "",
  ].filter(Boolean).filter((value, index, values) => values.findIndex((candidate) => normalizedBowlTeamLabel(candidate) === normalizedBowlTeamLabel(value)) === index);
  const firstCandidates = candidates(first, firstBase);
  const secondCandidates = candidates(second, secondBase);
  for (const firstLabel of firstCandidates) {
    for (const secondLabel of secondCandidates) {
      if (normalizedBowlTeamLabel(firstLabel) !== normalizedBowlTeamLabel(secondLabel)) return [firstLabel, secondLabel];
    }
  }

  return [`${firstBase} (1)`, `${secondBase} (2)`];
}

/** December 7 at 3:00 AM Eastern. Commissioners bypass this player-facing gate. */
export function bowlPoolLaunchAt(seasonYear) {
  return easternDateTimeToUtc(seasonYear, 12, 7, 3).toISOString();
}

/** Sort by ATS wins, then smallest absolute difference from the CFP final total. */
/**
 * Bowl standings order, used by the Bowl Card. Most wins first. Once the
 * championship game is final, the same rule as the database champion: a guess
 * beats no guess, then the closest guess wins. Remaining ties: fewer losses,
 * then a stable player order.
 */
export function compareBowlPoolStandings(first, second, finalCombinedPoints = null) {
  if (first.wins !== second.wins) return second.wins - first.wins;
  if (Number.isInteger(finalCombinedPoints)) {
    // A missing guess loses the tiebreaker to any guess (it is not a guess of 0).
    const firstDifference = Number.isInteger(first.tiebreakerTotal) ? Math.abs(first.tiebreakerTotal - finalCombinedPoints) : null;
    const secondDifference = Number.isInteger(second.tiebreakerTotal) ? Math.abs(second.tiebreakerTotal - finalCombinedPoints) : null;
    if (firstDifference !== null && secondDifference === null) return -1;
    if (firstDifference === null && secondDifference !== null) return 1;
    if (firstDifference !== null && secondDifference !== null && firstDifference !== secondDifference) return firstDifference - secondDifference;
  }
  return (first.losses ?? 0) - (second.losses ?? 0) || String(first.playerId).localeCompare(String(second.playerId));
}

/**
 * The school's name as a player knows it ("Ohio State", "Georgia Southern"):
 * the saved short name, then the full name. Abbreviations are only a last
 * resort, because many schools share look-alike abbreviations.
 */
export function bowlTeamName(team) {
  if (!team) return "TBD";
  for (const candidate of [team.short_name, team.full_name]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return bowlTeamDisplayLabel(team);
}

/** Both names for one matchup; the full names if the short ones collide. */
export function bowlMatchupTeamNames(first, second) {
  const firstName = bowlTeamName(first);
  const secondName = bowlTeamName(second);
  if (firstName.toLowerCase() !== secondName.toLowerCase()) return [firstName, secondName];
  const firstFull = typeof first?.full_name === "string" && first.full_name.trim() ? first.full_name.trim() : firstName;
  const secondFull = typeof second?.full_name === "string" && second.full_name.trim() ? second.full_name.trim() : secondName;
  return firstFull.toLowerCase() !== secondFull.toLowerCase() ? [firstFull, secondFull] : [`${firstName} (1)`, `${secondName} (2)`];
}
