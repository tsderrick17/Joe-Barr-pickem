import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";
import { espnGameIsCancelled, espnGameIsFinal } from "../src/lib/bowl-pool-espn-schedule.js";

// What the Bowl worker does with the status ESPN gives each game: only "final" is a result, and a game ESPN lists as cancelled is cancelled here on the
// second run in a row that sees it so, never on the first.
const NOW = new Date("2026-12-20T18:00:00Z");
let game; let database;
const respond = (table, calls) => {
  const names = calls.map(([name]) => name);
  if (table === "bowl_pool_seasons") return { data: { id: "season-1", player_visible_at: "2026-12-07T08:00:00Z", first_kickoff_at: game.kickoff_at }, error: null };
  if (table === "bowl_pool_games") return names.includes("update") ? { data: null, error: null } : { data: [game], error: null };
  if (table === "bowl_pool_game_lines") return { data: [], error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlStatusFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlStatusFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
delete process.env.BOWL_POOL_ODDS_API_ENABLED;
const { syncBowlPool } = await import("../src/lib/sync-bowl-pool.ts");
const { ProviderUnavailable } = await import("../src/lib/provider-unavailable.ts");
const { resetOperationalWarningMemo } = await import("../src/lib/operational-warnings.ts");

const realFetch = globalThis.fetch;
const realConsoleWarn = console.warn;
const EVENT = (name, { away = "0", home = "0", completed = false } = {}) => ({
  id: "401", status: { type: { name, completed } },
  competitions: [{ status: { type: { name, completed } }, competitors: [{ homeAway: "away", score: away }, { homeAway: "home", score: home }] }],
});
/** One worker run against an ESPN that answers with `event` (or with an error status when `event` is null), for a game already marked or not. */
async function run(event, { seenAt = null, cancelFails = false } = {}) {
  game = { id: "game-1", provider_game_id: "espn:401", odds_event_id: null, kickoff_at: "2026-12-20T17:00:00Z", line_lock_at: "2026-12-20T13:00:00Z", away_team_id: "a", home_team_id: "b", status: "live", order_index: 1, espn_cancelled_seen_at: seenAt };
  resetOperationalWarningMemo();
  database = recordingDatabase(respond, { rpc: (name) => ({ data: null, error: cancelFails && name === "record_bowl_game_cancelled_by_espn" ? { code: "P0001", message: "A settled or cancelled Bowl Pool game cannot be changed." } : null }) });
  bowlStatusFixture.database = database;
  globalThis.fetch = event ? async () => ({ ok: true, json: async () => ({ events: [event] }) }) : async () => ({ ok: false, status: 503 });
  try { return await syncBowlPool(NOW); } finally { globalThis.fetch = realFetch; }
}
const gameWrites = () => database.queries.filter((query) => query.table === "bowl_pool_games").flatMap((query) => query.calls).filter(([name]) => name === "update").map(([, args]) => args[0]);
const cancelCalls = () => database.rpcCalls.filter((call) => call.name === "record_bowl_game_cancelled_by_espn");

test("only ESPN's final status is a result: a score on a cancelled, postponed or unfinished game is never graded", async () => {
  const result = await run(EVENT("STATUS_FINAL", { away: "24", home: "17", completed: true }));
  assert.equal(result.finalizedGames, 1);
  const [final] = gameWrites().filter((patch) => patch.status === "final");
  assert.deepEqual({ status: final.status, away_score: final.away_score, home_score: final.home_score }, { status: "final", away_score: 24, home_score: 17 });
  for (const [name, completed, score] of [["STATUS_CANCELED", true, "0"], ["STATUS_POSTPONED", false, "0"], ["STATUS_IN_PROGRESS", false, "10"], ["STATUS_SUSPENDED", false, "10"]]) {
    const other = await run(EVENT(name, { away: score, home: score, completed }));
    assert.equal(other.finalizedGames, 0, name);
    assert.deepEqual(gameWrites().filter((patch) => patch.status === "final"), [], `${name} is not graded`);
  }
});

test("the first run that sees a game cancelled only marks it; the second run cancels it, and its picks are voided by the Commissioner's own path", async () => {
  const first = await run(EVENT("STATUS_CANCELED", { completed: true }));
  assert.equal(first.gamesCancelled, 0);
  assert.deepEqual(gameWrites().filter((patch) => "espn_cancelled_seen_at" in patch), [{ espn_cancelled_seen_at: NOW.toISOString() }]);
  assert.deepEqual(cancelCalls(), [], "one sighting never cancels a game");

  const second = await run(EVENT("STATUS_CANCELED", { completed: true }), { seenAt: "2026-12-20T17:45:00Z" });
  assert.equal(second.gamesCancelled, 1);
  assert.deepEqual(cancelCalls().map((call) => call.args), [{ target_game_id: "game-1" }]);
  assert.deepEqual(gameWrites().filter((patch) => patch.status === "final"), [], "its 0-0 is never graded");
});

test("when ESPN stops saying cancelled the mark is cleared, so a later sighting starts over; a postponed game is left alone", async () => {
  const back = await run(EVENT("STATUS_IN_PROGRESS", { away: "3", home: "0" }), { seenAt: "2026-12-20T17:45:00Z" });
  assert.equal(back.gamesCancelled, 0);
  assert.deepEqual(gameWrites().filter((patch) => "espn_cancelled_seen_at" in patch), [{ espn_cancelled_seen_at: null }]);
  assert.deepEqual(cancelCalls(), []);

  const postponed = await run(EVENT("STATUS_POSTPONED"));
  assert.equal(postponed.gamesCancelled, 0);
  assert.deepEqual(gameWrites().filter((patch) => "espn_cancelled_seen_at" in patch), [], "postponed is for the Commissioner to review, not an automatic cancellation");
  assert.deepEqual(cancelCalls(), []);
});

test("an ESPN that cannot be read neither confirms nor clears a sighting", async () => {
  await assert.rejects(run(null, { seenAt: "2026-12-20T17:45:00Z" }), ProviderUnavailable);
  assert.deepEqual(gameWrites().filter((patch) => "espn_cancelled_seen_at" in patch), []);
  assert.deepEqual(cancelCalls(), []);
});

test("a cancellation the database refuses is raised as a warning and does not stop the rest of the run", async () => {
  console.warn = () => undefined;
  try {
    const result = await run(EVENT("STATUS_CANCELED", { completed: true }), { seenAt: "2026-12-20T17:45:00Z", cancelFails: true });
    assert.equal(result.gamesCancelled, 0, "a refused cancellation is not counted");
    assert.ok(database.rpcCalls.some((call) => call.name === "grade_bowl_pool_final_picks"), "grading still ran");
  } finally { console.warn = realConsoleWarn; }
  const warnings = database.rpcCalls.filter((call) => call.name === "record_operational_warning" && /could not be cancelled/.test(call.args.target_message));
  assert.deepEqual(warnings.map((call) => [call.args.target_job, call.args.target_message, call.args.target_details.code]), [["bowl_scores", "A Bowl Pool game ESPN lists as cancelled could not be cancelled.", "P0001"]]);
});

test("ESPN's final status wins only when nothing on the game says cancelled, on the event or its competition", () => {
  const status = (name) => ({ type: { name } });
  assert.equal(espnGameIsFinal({ id: "1", date: "", status: status("STATUS_FINAL") }), true);
  assert.equal(espnGameIsFinal({ id: "1", date: "", competitions: [{ status: status("STATUS_FINAL") }] }), true, "the competition's own status counts");
  assert.equal(espnGameIsFinal({ id: "1", date: "", status: status("STATUS_FINAL"), competitions: [{ status: status("STATUS_CANCELED") }] }), false);
  assert.equal(espnGameIsFinal({ id: "1", date: "", status: { type: { completed: true } } }), false, "a completed flag alone is not a result");
  assert.equal(espnGameIsCancelled({ id: "1", date: "", competitions: [{ status: status("STATUS_CANCELED") }] }), true);
  for (const name of ["STATUS_POSTPONED", "STATUS_SUSPENDED", "STATUS_FINAL", "STATUS_SCHEDULED", undefined]) assert.equal(espnGameIsCancelled({ id: "1", date: "", status: status(name) }), false, String(name));
});
