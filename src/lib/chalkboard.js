import { ET } from "./game-lines.js";

/**
 * The clubhouse chalkboard's Bowl Pool side: the Season Snapshot's chart, drawn for the Bowl Pool.
 *  - `bowlChartReady`: the Bowl side appears once the first 10 bowls are final (owner, 2026-11-21), so it opens with a real race;
 *  - `bowlSnapshot` turns the Bowl Pool's read into the Season Snapshot's shape: one point per bowl day, each player's running wins.
 */

const OFF = new Set(["postponed", "cancelled", "no_contest"]);

/** How many bowls must be final before the chalkboard and the Season Snapshot show the Bowl Pool's chart. */
export const BOWL_CHART_AFTER = 10;

/** Whether the Bowl Pool's chart is shown yet: once `BOWL_CHART_AFTER` bowls are final. */
export const bowlChartReady = (payload) => (payload?.games ?? []).filter((game) => game.status === "final").length >= BOWL_CHART_AFTER;

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
