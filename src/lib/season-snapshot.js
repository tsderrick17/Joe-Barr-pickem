/** A point is added only when the scoring period has fully settled. */
export function buildSeasonSnapshot(periods, players, picks) {
  const settled = periods
    .filter((period) => period.status === "complete")
    .sort((a, b) => a.display_order - b.display_order);
  const playerIds = new Set(players.map((player) => player.id));
  const winsByPeriod = new Map();
  for (const pick of picks) {
    if (pick.result !== "win" || !playerIds.has(pick.player_id)) continue;
    const key = `${pick.scoring_period_id}:${pick.player_id}`;
    winsByPeriod.set(key, (winsByPeriod.get(key) ?? 0) + 1);
  }
  const totals = new Map(players.map((player) => [player.id, 0]));
  return settled.map((period) => {
    const scores = players.map((player) => {
      const total = (totals.get(player.id) ?? 0) + (winsByPeriod.get(`${period.id}:${player.id}`) ?? 0);
      totals.set(player.id, total);
      return { playerId: player.id, wins: total };
    });
    return { id: period.id, label: period.display_name, scores };
  });
}
