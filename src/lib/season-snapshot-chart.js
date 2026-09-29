/** Fit the timeline to the chart: baseline at the left, latest week at the right. */
export function snapshotX(weekIndex, weekCount, width = 700) {
  const left = 48;
  const right = 18;
  return left + weekIndex * ((width - left - right) / Math.max(1, weekCount));
}

/** Lower-ranked colors are painted widest first; leaders remain visible inside. */
export function snapshotLayers(weeks, standings, startWinsById = {}) {
  const segments = [];
  let previous = new Map(standings.map((player) => [player.id, startWinsById[player.id] ?? 0]));

  for (const [weekIndex, week] of weeks.entries()) {
    const current = new Map(week.scores.map((score) => [score.playerId, score.wins]));
    const bySegment = new Map();

    for (const player of standings) {
      if (!current.has(player.id)) continue;
      const from = previous.get(player.id);
      const to = current.get(player.id);
      if (from !== undefined) {
        const segmentKey = `${from}:${to}`;
        bySegment.set(segmentKey, [...(bySegment.get(segmentKey) ?? []), player.id]);
      }
    }

    for (const [key, playerIds] of bySegment) {
      const [from, to] = key.split(":").map(Number);
      segments.push({ weekIndex, from, to, playerIds: playerIds.reverse() });
    }
    previous = current;
  }

  return { segments };
}

/** Touching ribbon lanes, centered on each score; current leaders sit above peers.
 * Shared node boundaries keep joins continuous when a bundle splits or merges.
 * Inside a segment, only players sharing that path occupy its bundle.
 */
export function snapshotRibbons(weeks, standings, baseline, x, y, thickness = 3) {
  const scores = [standings.map((player) => ({ playerId: player.id, wins: baseline[player.id] ?? 0 })), ...weeks.map((week) => week.scores)];
  const nodes = scores.map((entries, weekIndex) => {
    const totals = new Map(entries.map((entry) => [entry.playerId, entry.wins]));
    const groups = new Map();
    for (const player of standings) {
      if (!totals.has(player.id)) continue;
      const wins = totals.get(player.id);
      groups.set(wins, [...(groups.get(wins) ?? []), player.id]);
    }
    const positions = new Map();
    for (const [wins, ids] of groups) {
      ids.forEach((id, rank) => {
        const top = y(wins) + (rank - ids.length / 2) * thickness;
        // Every regular-season line originates at the same zero, without a dot.
        positions.set(id, weekIndex === 0 && wins === 0
          ? { top: y(wins), bottom: y(wins) }
          : { top, bottom: top + thickness });
      });
    }
    return positions;
  });
  return snapshotLayers(weeks, standings, baseline).segments.flatMap((segment) => {
    const ids = [...segment.playerIds].reverse();
    return ids.map((playerId, rank) => {
      const start = nodes[segment.weekIndex].get(playerId);
      const end = nodes[segment.weekIndex + 1].get(playerId);
      const topOffset = (rank - ids.length / 2) * thickness;
      const points = [0, 0.18, 0.82, 1].map((fraction) => {
        const center = y(segment.from) + (y(segment.to) - y(segment.from)) * fraction;
        const bounds = fraction === 0 ? start : fraction === 1 ? end : { top: center + topOffset, bottom: center + topOffset + thickness };
        return { x: x(segment.weekIndex) + (x(segment.weekIndex + 1) - x(segment.weekIndex)) * fraction, ...bounds };
      });
      return { playerId, weekIndex: segment.weekIndex, points };
    });
  });
}

/** A filled strip, including inset bevel strips that never extend outside it. */
export function snapshotRibbonPath(points, upper = 0, lower = 1) {
  const edge = (fraction) => points.map((point) => `${point.x},${point.top + (point.bottom - point.top) * fraction}`);
  return `M${edge(upper).join(" L")} L${edge(lower).reverse().join(" L")} Z`;
}
