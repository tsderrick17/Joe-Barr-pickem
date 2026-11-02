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

/** Touching ribbon lanes, centered on each score; current leaders sit above peers.
 * Shared node boundaries keep joins continuous when a bundle splits or merges.
 * Each week is one straight band from the player's slot at the start of the
 * week to their slot at the end, so a line only bends at week boundaries, the
 * same as an ordinary line chart. Slots keep the same stacking order at both
 * ends, so bands on a shared path never cross or overlap.
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
    return ids.map((playerId) => {
      const start = nodes[segment.weekIndex].get(playerId);
      const end = nodes[segment.weekIndex + 1].get(playerId);
      const points = [{ x: x(segment.weekIndex), ...start }, { x: x(segment.weekIndex + 1), ...end }];
      return { playerId, weekIndex: segment.weekIndex, points };
    });
  });
}

/** A filled strip, including inset bevel strips that never extend outside it. */
export function snapshotRibbonPath(points, upper = 0, lower = 1) {
  const edge = (fraction) => points.map((point) => `${point.x},${point.top + (point.bottom - point.top) * fraction}`);
  return `M${edge(upper).join(" L")} L${edge(lower).reverse().join(" L")} Z`;
}

/**
 * The lowest and highest totals the shown players reach between two points of the timeline, measured in weeks from the
 * baseline (0) and allowed to fall between weeks: where a line crosses an edge of the view counts, so the range moves
 * smoothly as the view scrolls. A week a player has no score for carries their previous total forward.
 * @param {Array<{ scores: Array<{ playerId: string, wins: number }> }>} weeks
 * @param {Array<{ id: string }>} players
 * @param {Record<string, number>} baseline
 * @param {number} from
 * @param {number} to
 */
export function snapshotWindowRange(weeks, players, baseline, from, to) {
  const last = weeks.length;
  const start = Math.max(0, Math.min(from, to, last));
  const end = Math.min(last, Math.max(from, to, 0));
  let min = Infinity;
  let max = -Infinity;
  for (const player of players) {
    const line = [baseline[player.id] ?? 0];
    for (const week of weeks) {
      const score = week.scores.find((entry) => entry.playerId === player.id);
      line.push(score ? score.wins : line[line.length - 1]);
    }
    const at = (point) => {
      const below = Math.floor(point);
      const above = Math.min(last, below + 1);
      return line[below] + (line[above] - line[below]) * (point - below);
    };
    for (const value of [at(start), at(end), ...line.slice(Math.ceil(start), Math.floor(end) + 1)]) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  return min === Infinity ? { min: 0, max: 0 } : { min, max };
}

/**
 * The six-week stretch the 6 Wk axis is for, from how far the chart is scrolled. The stretch is always a full window
 * inside the season: pulling past either end (the bounce on a phone) still counts as the first or the latest six
 * weeks, never a shorter piece. Between the ends it follows the scroll to a twentieth of a week.
 * @param {number} scrollLeft
 * @param {number} step  pixels per week
 * @param {number} weekCount
 * @param {number} windowWeeks
 */
export function snapshotStretch(scrollLeft, step, weekCount, windowWeeks) {
  const latest = Math.max(0, weekCount - windowWeeks);
  const from = Math.min(latest, Math.max(0, Math.round((scrollLeft / step) * 20) / 20));
  return { from, to: from + windowWeeks };
}

/** How many even gaps an axis may split into, most first: never more than six lines. */
const GAP_COUNTS = [5, 4, 3, 2, 1];
const gapsFor = (span) => GAP_COUNTS.find((gaps) => span % gaps === 0) ?? 1;

/**
 * The wins axis. The bottom line is the lowest score shown (zero for the whole regular season, where everyone starts)
 * and the top line is one or two wins over the leader, never on it. Every line is numbered and evenly spaced in whole
 * wins, six lines at most: of the two possible tops, the one that splits into more lines (the nearer one on a tie).
 * @param {number} min
 * @param {number} max
 * @param {boolean} fromZero
 */
export function snapshotAxis(min, max, fromZero) {
  const low = fromZero ? 0 : Math.max(0, Math.floor(min));
  const near = Math.floor(max) + 1 - low;
  const span = gapsFor(near + 1) > gapsFor(near) ? near + 1 : near;
  return { low, ceiling: low + span, tickStep: span / gapsFor(span) };
}
