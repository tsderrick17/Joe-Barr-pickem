/** Fit the timeline to the chart: baseline at the left, latest week at the right. */
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
  const timelines = new Map(players.map((player) => [player.id, [baseline[player.id] ?? 0]]));
  for (const week of weeks) {
    const scores = new Map(week.scores.map((score) => [score.playerId, score.wins]));
    for (const player of players) {
      const line = timelines.get(player.id);
      line.push(scores.has(player.id) ? scores.get(player.id) : line[line.length - 1]);
    }
  }
  return players
    .map((player, index) => ({ player, index, line: timelines.get(player.id) }))
    .sort((a, b) => {
      for (let week = a.line.length - 1; week >= 0; week -= 1) {
        if (a.line[week] !== b.line[week]) return b.line[week] - a.line[week];
      }
      return a.index - b.index;
    })
    .map((entry) => entry.player);
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

/** Sample points along each segment. Lane changes happen only in the outer 30%
 * at each end, so a bundle holds together through the middle of the week. */
const RIBBON_FRACTIONS = [0, 0.06, 0.12, 0.18, 0.24, 0.3, 0.5, 0.7, 0.76, 0.82, 0.88, 0.94, 1];
const LANE_EASE = 0.3;

/** Smootherstep: zero slope at both ends, so a lane change never makes a corner. */
function ease(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Touching ribbon lanes, centered on each score; current leaders sit above peers.
 * Shared node boundaries keep joins continuous when a bundle splits or merges.
 * Inside a segment, only players sharing that path occupy its bundle. Moving
 * between a node's lane and the bundle's lane is eased rather than a straight
 * jog, which keeps reordering from putting sharp kinks in a line.
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
      const startLane = { top: start.top - y(segment.from), bottom: start.bottom - y(segment.from) };
      const endLane = { top: end.top - y(segment.to), bottom: end.bottom - y(segment.to) };
      const bundleLane = { top: topOffset, bottom: topOffset + thickness };
      const blend = (from, to, t) => ({ top: from.top + (to.top - from.top) * ease(t), bottom: from.bottom + (to.bottom - from.bottom) * ease(t) });
      const points = RIBBON_FRACTIONS.map((fraction) => {
        const center = y(segment.from) + (y(segment.to) - y(segment.from)) * fraction;
        const lane = fraction <= LANE_EASE ? blend(startLane, bundleLane, fraction / LANE_EASE)
          : fraction >= 1 - LANE_EASE ? blend(bundleLane, endLane, (fraction - (1 - LANE_EASE)) / LANE_EASE)
            : bundleLane;
        const bounds = fraction === 0 ? start : fraction === 1 ? end : { top: center + lane.top, bottom: center + lane.bottom };
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
