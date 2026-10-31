import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { insertedRow, recordingDatabase } from "./helpers/recording-database.mjs";

// The provider sync's line-lock stage, run for real with the Odds API off (as in production): a line saved by the ESPN schedule pull stays preliminary
// until 8 AM Eastern on game day, becomes official exactly once then, and a repeat run adds nothing.
const GAME = { id: "game-1", kickoff_at: "2026-12-15T22:30:00Z", line_lock_at: "2026-12-15T13:00:00Z", odds_event_id: null, away_team_id: "a", home_team_id: "b", away: { display_name: "Troy" }, home: { display_name: "Memphis" } };
const PRELIMINARY = { game_id: "game-1", favorite_team_id: "b", source_spread: 3, locked_spread: 3.5, source: "ESPN", source_captured_at: "2026-12-08T12:00:00Z", locked_at: null };
let lines, database;
const respond = (table, calls) => {
  const names = calls.map(([name]) => name);
  if (table === "bowl_pool_seasons") return { data: { id: "season-1" }, error: null };
  if (table === "bowl_pool_games") return { data: [GAME], error: null };
  if (table === "bowl_pool_game_lines") {
    if (!names.includes("update")) return { data: [...lines.values()], error: null };
    // An update guarded by `.is("locked_at", null)` changes only an unlocked line, and says which rows it changed, as the real table does.
    const gameId = calls.find(([name, args]) => name === "eq" && args[0] === "game_id")[1][1];
    const current = lines.get(gameId);
    if (!current || current.locked_at !== null) return { data: [], error: null };
    lines.set(gameId, { ...current, ...calls.find(([name]) => name === "update")[1][0] });
    return { data: [{ game_id: gameId }], error: null };
  }
  if (table === "bowl_pool_spread_history") return { data: null, error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlLineLockFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlLineLockFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
delete process.env.BOWL_POOL_ODDS_API_ENABLED;
const { syncScheduleAndLines } = await import("../src/lib/sync-bowl-pool.ts");

const sync = async (now) => { database = recordingDatabase(respond); bowlLineLockFixture.database = database; return syncScheduleAndLines(new Date(now)); };
const lineUpdates = () => database.queries.filter((query) => query.table === "bowl_pool_game_lines" && query.calls.some(([name]) => name === "update"));
const historyRows = () => database.queries.filter((query) => query.table === "bowl_pool_spread_history").map((query) => insertedRow(query.calls));

test("a preliminary line stays preliminary until game day: nothing is locked or recorded days earlier", async () => {
  lines = new Map([["game-1", { ...PRELIMINARY }]]);
  for (const now of ["2026-12-08T09:00:00Z", "2026-12-14T22:30:00Z", "2026-12-15T12:59:00Z"]) {
    assert.deepEqual(await sync(now), { scheduleGames: 0, linesLocked: 0 }, now);
    assert.equal(lineUpdates().length, 0, `${now}: no lock attempted`);
    assert.deepEqual(historyRows(), [], `${now}: no history row`);
  }
  assert.equal(lines.get("game-1").locked_at, null);
});

test("at 8 AM Eastern on game day the line becomes official once, with one history row; a repeat run changes nothing", async () => {
  lines = new Map([["game-1", { ...PRELIMINARY }]]);
  assert.deepEqual(await sync("2026-12-15T13:05:00Z"), { scheduleGames: 0, linesLocked: 1 });
  assert.equal(lines.get("game-1").locked_at, "2026-12-15T13:05:00.000Z");
  assert.deepEqual(historyRows().map((row) => ({ game_id: row.game_id, pool_spread: row.pool_spread, source: row.source })), [{ game_id: "game-1", pool_spread: 3.5, source: "ESPN" }]);
  assert.deepEqual(await sync("2026-12-15T13:20:00Z"), { scheduleGames: 0, linesLocked: 0 }, "already official");
  assert.equal(lineUpdates().length, 0, "an official line is never touched again");
  assert.deepEqual(historyRows(), []);
  assert.equal(lines.get("game-1").locked_at, "2026-12-15T13:05:00.000Z", "the lock time is the first one");
});

test("a game with no line yet is left for the schedule pull or the Commissioner, and a lost race writes no history", async () => {
  lines = new Map();
  assert.deepEqual(await sync("2026-12-15T13:05:00Z"), { scheduleGames: 0, linesLocked: 0 });
  assert.equal(lineUpdates().length, 0);
  // The line locked between the read and the update (another run, or a Commissioner entry): the guarded update changes nothing, so no history row is added.
  lines = new Map([["game-1", { ...PRELIMINARY }]]);
  database = recordingDatabase((table, calls) => {
    if (table === "bowl_pool_game_lines" && calls.some(([name]) => name === "update")) return { data: [], error: null };
    return respond(table, calls);
  });
  bowlLineLockFixture.database = database;
  assert.deepEqual(await syncScheduleAndLines(new Date("2026-12-15T13:05:00Z")), { scheduleGames: 0, linesLocked: 0 });
  assert.deepEqual(historyRows(), []);
});
