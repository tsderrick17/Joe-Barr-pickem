/**
 * Classifies a provider schedule refresh before it reaches the database.
 * Missing provider events are a warning only: they are never deletion input.
 */
export function reconcileSchedule({ savedGames, incomingGames, evaluatedAt }) {
  const savedByExternalId = new Map(
    savedGames.map((game) => [game.externalGameId, game]),
  );
  const incomingIds = new Set();
  const creates = [];
  const reschedules = [];
  const review = [];

  for (const incoming of incomingGames) {
    incomingIds.add(incoming.externalGameId);
    const saved = savedByExternalId.get(incoming.externalGameId);
    if (!saved) {
      creates.push(incoming);
      continue;
    }

    const kickoffChanged = saved.kickoffAt !== incoming.kickoffAt
      || saved.lineLockAt !== incoming.lineLockAt;
    if (!kickoffChanged) continue;

    if (saved.scoringPeriodId !== incoming.scoringPeriodId) {
      review.push({ externalGameId: incoming.externalGameId, reason: "scoring-period-change" });
    } else if (saved.awayTeamId !== incoming.awayTeamId || saved.homeTeamId !== incoming.homeTeamId) {
      review.push({ externalGameId: incoming.externalGameId, reason: "team-identity-change" });
    } else if (saved.status !== "scheduled") {
      review.push({ externalGameId: incoming.externalGameId, reason: "settled-or-disrupted" });
    } else if (new Date(saved.lineLockAt) <= evaluatedAt) {
      review.push({ externalGameId: incoming.externalGameId, reason: "line-already-locked" });
    } else {
      reschedules.push(incoming);
    }
  }

  return {
    creates,
    reschedules,
    review,
    missingFromProvider: savedGames.filter((game) => !incomingIds.has(game.externalGameId)),
  };
}
