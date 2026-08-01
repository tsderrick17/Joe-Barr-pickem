/**
 * The closing policy is deliberately small and deterministic: after every
 * scored Pick'em period is complete, every player tied for the top season
 * total receives the championship. We never manufacture a tiebreaker.
 */
export function resolvePickemChampions(results) {
  const completed = results.filter((row) => row.periodStatus === "complete");
  if (completed.length !== results.length || !results.length) return [];

  const winsByPlayer = new Map();
  for (const row of results) {
    if (row.result === "void") continue;
    if (row.result === "win") {
      winsByPlayer.set(row.playerId, (winsByPlayer.get(row.playerId) ?? 0) + 1);
    } else if (!winsByPlayer.has(row.playerId)) {
      winsByPlayer.set(row.playerId, 0);
    }
  }

  const leaderWins = Math.max(...winsByPlayer.values());
  return [...winsByPlayer]
    .filter(([, wins]) => wins === leaderWins)
    .map(([playerId]) => playerId)
    .sort();
}
