import { ET } from "./game-lines.js";

/**
 * The clubhouse chalkboard: the Season Snapshot drawn in chalk in the room, and from Dec 7 the Bowl Pool's own snapshot beside it.
 *  - `bowlSnapshot` turns the Bowl Pool's read into the Season Snapshot's shape: one point per bowl day, each player's running wins;
 *  - `chalkSketch` is what the board itself shows: the last few points of a snapshot as lines in a box, and who leads.
 */

const OFF = new Set(["postponed", "cancelled", "no_contest"]);

/** "Dec 20" for a kickoff, Eastern. */
const dayOf = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: ET, month: "short", day: "numeric" }).format(new Date(iso));
/** "2026-12-20", Eastern, so days sort in order. */
const dayKey = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/**
 * The Bowl Pool as a Season Snapshot: a point for each bowl day once every bowl that day is decided (final, or called off), with every
 * player's wins through that day, in the order the standings list them. A day still being played waits, so the chart moves once a day,
 * the way the Pick'em chart moves once a week. Picks are the revealed ones (a pick is never in the read before its kickoff) and any
 * result the pool gave automatically where a player had no pick, exactly as the Bowl Pool's own standings count them.
 * @param {any} payload the Bowl Pool's read (`/api/bowl-pool`)
 * @returns {{ weeks: Array<{ id: string, label: string, complete: boolean, scores: Array<{ playerId: string, wins: number }> }>, players: Array<{ id: string, firstName: string, wins: number }> }}
 */
export function bowlSnapshot(payload) {
  const players = (payload?.standings ?? []).map((row) => ({ id: row.playerId, firstName: row.playerName, wins: row.wins }));
  const games = (payload?.games ?? []).filter((game) => game.kickoff_at && Number.isFinite(Date.parse(game.kickoff_at)));
  const byDay = new Map();
  for (const game of [...games].sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))) {
    const key = dayKey(game.kickoff_at);
    if (!byDay.has(key)) byDay.set(key, { label: dayOf(game.kickoff_at), games: [] });
    byDay.get(key).games.push(game);
  }
  /** @type {Map<string, Map<string, "win" | "loss">>} game -> player -> result */
  const results = new Map();
  const note = (gameId, playerId, result, override) => {
    if (!playerId || (result !== "win" && result !== "loss")) return;
    const game = results.get(gameId) ?? new Map();
    if (override || !game.has(playerId)) game.set(playerId, result);
    results.set(gameId, game);
  };
  for (const pick of payload?.publicPicks ?? []) note(pick.game_id, pick.playerId, pick.result, true);
  for (const result of payload?.automaticResults ?? []) note(result.game_id, result.playerId, result.result, false);

  const running = new Map(players.map((player) => [player.id, 0]));
  const weeks = [];
  for (const [key, day] of byDay) {
    const decided = day.games.every((game) => game.status === "final" || OFF.has(game.status));
    const counted = day.games.filter((game) => game.status === "final");
    if (!decided || counted.length === 0) { if (!decided) break; continue; }
    for (const game of counted) for (const [playerId, result] of results.get(game.id) ?? []) if (result === "win" && running.has(playerId)) running.set(playerId, running.get(playerId) + 1);
    weeks.push({ id: key, label: day.label, complete: true, scores: players.map((player) => ({ playerId: player.id, wins: running.get(player.id) })) });
  }
  return { weeks, players };
}

/**
 * The chalkboard's sketch of a snapshot: its last `last` points (with the point before them as the start, so every line has a run-up),
 * each player's line as points in a `w` by `h` box (top is the most wins in view, bottom the fewest), and who leads at the end (all of
 * them, when level). Nothing to draw (no points yet) gives null.
 * @param {Array<{ label: string, scores: Array<{ playerId: string, wins: number }> }>} weeks
 * @param {Array<{ id: string, firstName: string }>} players
 * @param {{ w: number, h: number, last?: number, baseline?: Record<string, number> }} box
 */
export function chalkSketch(weeks, players, { w, h, last = 6, baseline = {} }) {
  const points = weeks.filter((week) => week.scores.length > 0);
  if (points.length === 0 || players.length === 0) return null;
  const shown = points.slice(-last);
  const before = points.length > shown.length ? points[points.length - shown.length - 1] : null;
  const winsAt = (week, id) => week.scores.find((score) => score.playerId === id)?.wins ?? 0;
  const start = (id) => (before ? winsAt(before, id) : baseline[id] ?? 0);
  const series = players.map((player) => ({ player, values: [start(player.id), ...shown.map((week) => winsAt(week, player.id))] }));
  const all = series.flatMap((line) => line.values);
  const low = Math.min(...all), high = Math.max(...all);
  const span = Math.max(1, high - low);
  const steps = series[0].values.length - 1;
  const x = (index) => (steps === 0 ? w / 2 : (index / steps) * w);
  const y = (wins) => h - ((wins - low) / span) * h;
  const lines = series.map(({ player, values }) => ({ id: player.id, name: player.firstName, wins: values.at(-1), points: values.map((wins, index) => [Math.round(x(index) * 10) / 10, Math.round(y(wins) * 10) / 10]) }));
  const top = Math.max(...lines.map((line) => line.wins));
  return { lines, leaders: lines.filter((line) => line.wins === top), from: shown[0].label, to: shown.at(-1).label };
}

/** The chalkboard's box for the lines, in its own pixels (the slate is 300 by 190; the title runs along the top, the leader along the foot). */
export const CHALK_BOX = { w: 252, h: 104 };

const leaderLine = (sketch) => (sketch.leaders.length === 1 ? `${sketch.leaders[0].name.toUpperCase()} LEADS · ${sketch.leaders[0].wins}` : `${sketch.leaders.length} TIED AT ${sketch.leaders[0].wins}`);
const weekNumber = (label) => label.match(/week\s*(\d+)/i)?.[1] ?? label;

/**
 * Every sketch the chalkboard shows, in turn: the Pick'em pool's (the playoffs once a playoff day is final, the last six weeks of the
 * regular season before then), and in bowl season the Bowl Pool's. Before there is anything to chart, a sketch carries a note instead
 * (a player who cannot see the Season Snapshot yet, before Week 6 settles, gets the same note the pad gives).
 * @param {{ pickem: { regular: any[], playoffs: any[] } | null, players: Array<{ id: string, firstName: string }>, colors: Map<string, string>,
 *   hidden?: boolean, bowl?: { weeks: any[], players: Array<{ id: string, firstName: string }> } | null }} input
 */
export function chalkPages({ pickem, players, colors, hidden = false, bowl = null }) {
  const color = (id) => colors.get(id) ?? "#f4f1e8";
  const draw = (sketch) => sketch.lines.map((line) => ({ id: line.id, color: color(line.id), points: line.points }));
  const pages = [];
  const regular = pickem?.regular ?? [];
  const playoffs = (pickem?.playoffs ?? []).filter((week) => week.scores.length > 0);
  const lastRegular = regular.filter((week) => week.scores.length > 0).at(-1);
  if (hidden) pages.push({ title: "SEASON SNAPSHOT", span: "", lines: [], leader: "", note: "Opens after Week 6" });
  else if (playoffs.length) {
    const baseline = Object.fromEntries((lastRegular?.scores ?? []).map((score) => [score.playerId, score.wins]));
    const sketch = chalkSketch(playoffs, players, { ...CHALK_BOX, baseline });
    if (sketch) pages.push({ title: "PLAYOFFS", span: String(sketch.to).toUpperCase(), lines: draw(sketch), leader: leaderLine(sketch) });
  } else {
    const sketch = chalkSketch(regular, players, CHALK_BOX);
    pages.push(sketch
      ? { title: "SEASON SNAPSHOT", span: sketch.from === sketch.to ? `WEEK ${weekNumber(sketch.to)}` : `WEEKS ${weekNumber(sketch.from)}–${weekNumber(sketch.to)}`, lines: draw(sketch), leader: leaderLine(sketch) }
      : { title: "SEASON SNAPSHOT", span: "", lines: [], leader: "", note: pickem ? "After the first week" : "" });
  }
  if (bowl) {
    const sketch = chalkSketch(bowl.weeks, bowl.players, CHALK_BOX);
    pages.push(sketch
      ? { title: "BOWL POOL", span: sketch.from === sketch.to ? sketch.to.toUpperCase() : `${sketch.from} – ${sketch.to}`.toUpperCase(), lines: draw(sketch), leader: leaderLine(sketch) }
      : { title: "BOWL POOL", span: "", lines: [], leader: "", note: "After the first bowl day" });
  }
  return pages;
}
