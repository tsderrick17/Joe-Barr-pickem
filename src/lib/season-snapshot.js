/** Players see the Season Snapshot from Week 6 on. A new season (Aug 1) starts
 * with every period upcoming, so it disappears again until that season's Week 6. */
export const SNAPSHOT_RELEASE_WEEK = 6;
export function seasonSnapshotReleased(periods) {
  return periods.some((period) =>
    ["active", "complete"].includes(period.status)
    && (period.period_type === "playoff" || (period.period_type === "regular" && period.display_order >= SNAPSHOT_RELEASE_WEEK)));
}

/** Build weekly positions. Everyone is plotted together for a week, and the
 * active week appears only once its last Pick'em pick has settled: every game
 * has kicked off (no pick can still be added) and no pick is pending. */
export function buildSeasonSnapshot(periods, players, picks, activeWeekSettled = new Set()) {
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
    for (const playerId of playerIds) {
      const playerPicks = picksByPeriodAndPlayer.get(`${period.id}:${playerId}`) ?? [];
      const graded = playerPicks.filter((pick) => pick.result === "win" || pick.result === "loss");
      if (period.status === "active" && !activeWeekSettled.has(period.id)) continue;
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
