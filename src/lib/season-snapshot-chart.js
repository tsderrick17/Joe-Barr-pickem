/** Exact shared week columns. No player-specific horizontal offsets. */
export const snapshotX = (weekIndex) => 62 + weekIndex * 54;

/** Lower-ranked colors are painted widest first; leaders remain visible inside. */
export function snapshotLayers(weeks, standings, startWinsById = {}) {
  const segments = [];
  const pointGroups = [];
  let previous = new Map(standings.map((player) => [player.id, startWinsById[player.id] ?? 0]));
  const baseline = new Map();
  for (const player of standings) {
    const wins = previous.get(player.id);
    baseline.set(wins, [...(baseline.get(wins) ?? []), player.id]);
  }
  for (const [wins, playerIds] of baseline) {
    pointGroups.push({ weekIndex: 0, wins, playerIds: playerIds.reverse() });
  }

  for (const [weekIndex, week] of weeks.entries()) {
    const current = new Map(week.scores.map((score) => [score.playerId, score.wins]));
    const bySegment = new Map();
    const byPoint = new Map();

    for (const player of standings) {
      if (!current.has(player.id)) continue;
      const from = previous.get(player.id);
      const to = current.get(player.id);
      if (from !== undefined) {
        const segmentKey = `${from}:${to}`;
        bySegment.set(segmentKey, [...(bySegment.get(segmentKey) ?? []), player.id]);
      }
      byPoint.set(to, [...(byPoint.get(to) ?? []), player.id]);
    }

    for (const [key, playerIds] of bySegment) {
      const [from, to] = key.split(":").map(Number);
      segments.push({ weekIndex, from, to, playerIds: playerIds.reverse() });
    }
    for (const [wins, playerIds] of byPoint) {
      pointGroups.push({ weekIndex: weekIndex + 1, wins, playerIds: playerIds.reverse() });
    }
    previous = current;
  }

  return { segments, pointGroups };
}
