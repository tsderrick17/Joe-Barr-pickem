import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { insertedRow, recordingDatabase } from "./helpers/recording-database.mjs";

// The Commissioner's hand-entered Bowl line, run through the real route with its database scripted: which games are offered, what a saved line looks like
// (official at once, flagged as a manual override, with its history row), and that a game that already has a line is never overwritten.
const NOW = "2026-12-18T20:00:00Z";
const GAMES = [
  { id: "due", bowl_name: "Frisco Bowl", kickoff_at: "2026-12-19T18:00:00Z", line_lock_at: "2026-12-19T13:00:00Z", status: "scheduled", away_team_id: "mem", home_team_id: "tol" },
  { id: "later", bowl_name: "Cure Bowl", kickoff_at: "2026-12-26T18:00:00Z", line_lock_at: "2026-12-26T13:00:00Z", status: "scheduled", away_team_id: "troy", home_team_id: "buff" },
  { id: "has-line", bowl_name: "Gasparilla Bowl", kickoff_at: "2026-12-19T22:00:00Z", line_lock_at: "2026-12-19T13:00:00Z", status: "scheduled", away_team_id: "gsu", home_team_id: "mrsh" },
  { id: "over", bowl_name: "Salute to Veterans", kickoff_at: "2026-12-10T22:00:00Z", line_lock_at: "2026-12-10T13:00:00Z", status: "final", away_team_id: "osu", home_team_id: "ore" },
];
const TEAMS = [{ id: "mem", display_name: "Memphis" }, { id: "tol", display_name: "Toledo" }, { id: "gsu", display_name: "Georgia Southern" }, { id: "mrsh", display_name: "Marshall" }, { id: "osu", display_name: "Ohio State" }, { id: "ore", display_name: "Oregon" }, { id: "troy", display_name: "Troy" }, { id: "buff", display_name: "Buffalo" }];
let gameRow, lineInsertError, database;
const respond = (table, calls) => {
  const one = calls.some(([name]) => name === "maybeSingle");
  if (table === "bowl_pool_seasons") return { data: { id: "season-1" }, error: null };
  if (table === "bowl_pool_games") return one ? { data: gameRow, error: null } : { data: GAMES.filter((game) => ["scheduled", "live", "final"].includes(game.status)), error: null };
  if (table === "bowl_pool_game_lines") return calls.some(([name]) => name === "insert") ? { data: null, error: lineInsertError } : { data: [{ game_id: "has-line" }], error: null };
  if (table === "bowl_pool_teams") return { data: TEAMS, error: null };
  if (table === "bowl_pool_spread_history") return { data: null, error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlLinesFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/require-commissioner") return { url: "data:text/javascript,export const commissionerAccess = async () => ({ ok: true, player: { id: 'commissioner-1' } });", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlLinesFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { GET, POST } = await import("../src/app/api/admin/bowl-pool/lines/route.ts");
const start = (game = GAMES[0], insertError = null) => { gameRow = game; lineInsertError = insertError; database = recordingDatabase(respond); bowlLinesFixture.database = database; };
const at = async (now, run) => { mock.timers.enable({ apis: ["Date"], now: Date.parse(now) }); try { return await run(); } finally { mock.timers.reset(); } };
const post = (body) => at(NOW, async () => {
  const response = await POST(new NextRequest("http://localhost/api/admin/bowl-pool/lines", { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
});
const inserted = (table) => database.queries.filter((query) => query.table === table).map((query) => insertedRow(query.calls)).filter(Boolean);

test("a game is offered once its line locks within a day and it has no line, or when it is over with none; one that has a line, or is later, is not", async () => {
  start();
  const response = await at(NOW, () => GET(new NextRequest("http://localhost/api/admin/bowl-pool/lines")));
  const { games } = await response.json();
  assert.deepEqual(games.map((game) => game.id).sort(), ["due", "over"]);
  assert.deepEqual(games.find((game) => game.id === "due"), { id: "due", bowlName: "Frisco Bowl", kickoffAt: "2026-12-19T18:00:00Z", lineLockAt: "2026-12-19T13:00:00Z", status: "scheduled", away: { id: "mem", name: "Memphis" }, home: { id: "tol", name: "Toledo" } });
});

test("a saved line is official at once, marked as the Commissioner's, and written to the spread history", async () => {
  start();
  const result = await post({ gameId: "due", favoriteTeamId: "tol", spread: 3.5 });
  assert.equal(result.status, 200);
  assert.match(result.body.message, /Frisco Bowl: line set to 3\.5\. It is official now\./);
  const [line] = inserted("bowl_pool_game_lines");
  assert.deepEqual({ ...line, source_captured_at: undefined, locked_at: undefined }, { game_id: "due", favorite_team_id: "tol", source_spread: 3.5, locked_spread: 3.5, source: "Commissioner", source_captured_at: undefined, locked_at: undefined, manual_override: true });
  assert.equal(line.locked_at, "2026-12-18T20:00:00.000Z", "locked now, not left preliminary");
  const [history] = inserted("bowl_pool_spread_history");
  assert.deepEqual({ game_id: history.game_id, favorite_team_id: history.favorite_team_id, source_spread: history.source_spread, pool_spread: history.pool_spread, source: history.source }, { game_id: "due", favorite_team_id: "tol", source_spread: 3.5, pool_spread: 3.5, source: "Commissioner" });
});

test("a pick'em is saved with no favorite and a spread of 0", async () => {
  start();
  assert.equal((await post({ gameId: "due", favoriteTeamId: null, spread: 0 })).status, 200);
  assert.deepEqual([inserted("bowl_pool_game_lines")[0].favorite_team_id, inserted("bowl_pool_game_lines")[0].locked_spread], [null, 0]);
});

test("a game that already has a line is never overwritten", async () => {
  start(GAMES[0], { code: "23505", message: "duplicate key" });
  const result = await post({ gameId: "due", favoriteTeamId: "tol", spread: 3.5 });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, "That game already has a line.");
  assert.deepEqual(inserted("bowl_pool_spread_history"), [], "no history row for a line that was not saved");
  const [query] = database.queries.filter((candidate) => candidate.table === "bowl_pool_game_lines");
  assert.equal(query.calls.some(([name]) => ["update", "upsert", "delete"].includes(name)), false, "only an insert, never a replace");
});

test("a line that cannot be right is refused before anything is written", async () => {
  for (const [body, problem] of [
    [{ gameId: "due", favoriteTeamId: "tol", spread: 3 }, /half point/],
    [{ gameId: "due", favoriteTeamId: "troy", spread: 3.5 }, /one of the two teams/],
    [{ gameId: "due", favoriteTeamId: "tol", spread: 35.5 }, /typing slip/],
  ]) {
    start();
    const result = await post(body);
    assert.equal(result.status, 400);
    assert.match(result.body.error, problem);
    assert.deepEqual(inserted("bowl_pool_game_lines"), []);
  }
  for (const body of [{}, { gameId: "due" }, { gameId: "due", favoriteTeamId: "tol" }, { gameId: "due", favoriteTeamId: "tol", spread: "3.5" }, { gameId: "due", favoriteTeamId: 7, spread: 3.5 }]) {
    start();
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
});

test("a game that is postponed or cancelled, has a team missing, or does not exist cannot take a line", async () => {
  for (const [game, status, text] of [
    [{ ...GAMES[0], status: "postponed" }, 400, /no line to set/],
    [{ ...GAMES[0], status: "cancelled" }, 400, /no line to set/],
    [{ ...GAMES[0], home_team_id: null }, 400, /Both teams/],
    [null, 404, /does not exist/],
  ]) {
    start(game);
    const result = await post({ gameId: "due", favoriteTeamId: "tol", spread: 3.5 });
    assert.equal(result.status, status);
    assert.match(result.body.error, text);
    assert.deepEqual(inserted("bowl_pool_game_lines"), []);
  }
});

test("a game that is over can still be given its line, so its picks can be graded", async () => {
  start(GAMES[3]);
  assert.equal((await post({ gameId: "over", favoriteTeamId: "ore", spread: 6.5 })).status, 200);
});
