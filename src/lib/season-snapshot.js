/** Build exact weekly positions, including a finished card in an active week. */
export function buildSeasonSnapshot(periods, players, picks) {
  const playerIds = players.map((player) => player.id);
  const picksByPeriodAndPlayer = new Map();
  for (const pick of picks) {
    const key = `${pick.scoring_period_id}:${pick.player_id}`;
    const playerPicks = picksByPeriodAndPlayer.get(key) ?? [];
    playerPicks.push(pick);
    picksByPeriodAndPlayer.set(key, playerPicks);
  }
  const snapshot = { regular: [], playoffs: [] };
  const totals = new Map(playerIds.map((id) => [id, 0]));
  const ordered = periods
    .filter((period) => ["regular", "playoff"].includes(period.period_type))
    .filter((period) => ["complete", "active"].includes(period.status))
    .sort((a, b) => a.display_order - b.display_order);

  for (const period of ordered) {
    const scores = [];
    const requiredPicks = Number.isInteger(period.max_picks) && period.max_picks > 0 ? period.max_picks : Infinity;
    for (const playerId of playerIds) {
      const playerPicks = picksByPeriodAndPlayer.get(`${period.id}:${playerId}`) ?? [];
      const graded = playerPicks.filter((pick) => pick.result === "win" || pick.result === "loss");
      if (period.status === "active" && graded.length < requiredPicks) continue;
      const wins = graded.filter((pick) => pick.result === "win").length;
      const total = (totals.get(playerId) ?? 0) + wins;
      totals.set(playerId, total);
      scores.push({ playerId, wins: total });
    }
    if (period.status === "complete" || scores.length) {
      snapshot[period.period_type === "regular" ? "regular" : "playoffs"].push({
        id: period.id,
        label: period.display_name,
        complete: period.status === "complete",
        scores,
      });
    }
  }
  return snapshot;
}
