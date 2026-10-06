// @ts-check
/** Fit the timeline to the chart: baseline at the left, latest week at the right. */
/** @param {number} weekIndex @param {number} weekCount @param {number} [width] @param {number} [left] @param {number} [right] */
export function snapshotX(weekIndex, weekCount, width = 700, left = 48, right = 18) {
  return left + weekIndex * ((width - left - right) / Math.max(1, weekCount));
}

/**
 * Stacking order for lines that share a path: top lane first.
 *
 * A line sits above another if it held the greater total more recently. For each
 * pair, look back from the latest week to the baseline and stop at the first week
 * their totals differ; whoever was higher then goes on top. Comparing each
 * player's totals from newest week to oldest is a single consistent ordering, so
 * lanes never swap mid-chart. Players whose histories are identical keep the
 * order they were given (current standings). A week a player has no score for
 * (an unfinished card) carries their previous total forward.
 *
 * @template {{ id: string }} T
 * @param {Array<{ scores: Array<{ playerId: string, wins: number }> }>} weeks
 * @param {T[]} players
 * @param {Record<string, number>} [baseline]
 * @returns {T[]}
 */
export function snapshotStackOrder(weeks, players, baseline = {}) {
  /** @type {Map<string, number[]>} */
  const timelines = new Map(players.map((player) => [player.id, [baseline[player.id] ?? 0]]));
  for (const week of weeks) {
    const scores = new Map(week.scores.map((score) => [score.playerId, score.wins]));
    for (const player of players) {
      const line = timelines.get(player.id);
      if (!line) throw new Error("Snapshot timeline is missing a player.");
      line.push(scores.get(player.id) ?? line[line.length - 1]);
    }
  }
  return players
    .map((player, index) => {
      const line = timelines.get(player.id);
      if (!line) throw new Error("Snapshot timeline is missing a player.");
      return { player, index, line };
    })
    .sort((a, b) => {
      for (let week = a.line.length - 1; week >= 0; week -= 1) {
        if (a.line[week] !== b.line[week]) return b.line[week] - a.line[week];
      }
      return a.index - b.index;
    })
    .map((entry) => entry.player);
}

/** Lower-ranked colors are painted widest first; leaders remain visible inside. */
/**
 * @param {Array<{ scores: Array<{ playerId: string, wins: number }> }>} weeks
 * @param {Array<{ id: string }>} standings
 * @param {Record<string, number>} [startWinsById]
 */
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
 * Each week is one straight band from the player's slot at the start of the
 * week to their slot at the end, so a line only bends at week boundaries, the
 * same as an ordinary line chart. Slots keep the same stacking order at both
 * ends, so bands on a shared path never cross or overlap.
 * @param {Array<{ scores: Array<{ playerId: string, wins: number }> }>} weeks
 * @param {Array<{ id: string }>} standings
 * @param {Record<string, number>} baseline
 * @param {(weekIndex: number) => number} x
 * @param {(wins: number) => number} y
 * @param {number} [thickness]
 */
export function snapshotRibbons(weeks, standings, baseline, x, y, thickness = 3) {
  const scores = [standings.map((player) => ({ playerId: player.id, wins: baseline[player.id] ?? 0 })), ...weeks.map((week) => week.scores)];
  const nodes = scores.map((entries, weekIndex) => {
    const totals = new Map(entries.map((entry) => [entry.playerId, entry.wins]));
    /** @type {Map<number, string[]>} */
    const groups = new Map();
    for (const player of standings) {
      if (!totals.has(player.id)) continue;
      const wins = totals.get(player.id);
      if (typeof wins !== "number") continue;
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
    return ids.map((playerId) => {
      const start = nodes[segment.weekIndex].get(playerId);
      const end = nodes[segment.weekIndex + 1].get(playerId);
      const points = [{ x: x(segment.weekIndex), ...start }, { x: x(segment.weekIndex + 1), ...end }];
      return { playerId, weekIndex: segment.weekIndex, points };
    });
  });
}

/** A filled strip, including inset bevel strips that never extend outside it. */
/** @param {Array<{ x: number, top: number, bottom: number }>} points @param {number} [upper] @param {number} [lower] */
export function snapshotRibbonPath(points, upper = 0, lower = 1) {
  /** @param {number} fraction */
  const edge = (fraction) => points.map((point) => `${point.x},${point.top + (point.bottom - point.top) * fraction}`);
  return `M${edge(upper).join(" L")} L${edge(lower).reverse().join(" L")} Z`;
}
