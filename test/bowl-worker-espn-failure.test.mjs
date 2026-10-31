import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The Bowl worker when ESPN cannot be read: the run must end as FAILED with the reason (not as a success that did nothing), yet the work that needs
// no ESPN (games going live, missing-pick losses, grading, the champion) must still have been done by then.
const GAME = { id: "game-1", provider_game_id: "espn:401", odds_event_id: null, kickoff_at: "2026-12-20T17:00:00Z", line_lock_at: "2026-12-20T13:00:00Z", away_team_id: "a", home_team_id: "b", status: "scheduled", order_index: 1 };
let database; let gameWrites;
const respond = (table, calls) => {
  const names = calls.map(([name]) => name);
  if (table === "bowl_pool_seasons") return { data: { id: "season-1", player_visible_at: "2026-12-07T08:00:00Z", first_kickoff_at: GAME.kickoff_at }, error: null };
  if (table === "bowl_pool_games") {
    if (names.includes("update")) { gameWrites.push(calls.find(([name]) => name === "update")[1][0]); return { data: null, error: null }; }
    return { data: [GAME], error: null };
  }
  if (table === "bowl_pool_game_lines") return { data: [], error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlEspnFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlEspnFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
delete process.env.BOWL_POOL_ODDS_API_ENABLED;
const { syncAnnualSchedule, syncBowlPool } = await import("../src/lib/sync-bowl-pool.ts");
const { ProviderUnavailable } = await import("../src/lib/provider-unavailable.ts");

const realFetch = globalThis.fetch;
const reset = () => { gameWrites = []; database = recordingDatabase(respond); bowlEspnFixture.database = database; };
const withEspn = async (answer, run) => { globalThis.fetch = answer; try { return await run(); } finally { globalThis.fetch = realFetch; } };
const NOW = new Date("2026-12-20T18:00:00Z");

test("ESPN unreachable, refusing, or answering with something unreadable is a ProviderUnavailable, never an empty success", async () => {
  for (const [label, answer, reason] of [
    ["unreachable", async () => { throw new Error("network down"); }, /could not be read/],
    ["an error status", async () => ({ ok: false, status: 503 }), /could not be read/],
    ["not json", async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }), /unreadable/],
    ["no event list", async () => ({ ok: true, json: async () => ({ message: "maintenance" }) }), /unreadable/],
  ]) {
    reset();
    await assert.rejects(withEspn(answer, () => syncAnnualSchedule(NOW)), (error) => error instanceof ProviderUnavailable && error.provider === "ESPN" && reason.test(error.message), label);
  }
  reset();
  assert.equal(await withEspn(async () => ({ ok: true, json: async () => ({ events: [] }) }), () => syncAnnualSchedule(NOW)), 0, "an empty list from a working ESPN is not a failure");
});

test("with ESPN down the run still starts games, settles and grades, and then ends as a failure naming both ESPN reads", async () => {
  reset();
  await assert.rejects(withEspn(async () => ({ ok: false, status: 503 }), () => syncBowlPool(NOW)), (error) => {
    assert.ok(error instanceof ProviderUnavailable);
    assert.match(error.message, /postseason schedule could not be read/);
    assert.match(error.message, /scores could not be read/);
    return true;
  });
  assert.deepEqual(gameWrites, [{ status: "live" }], "the game that kicked off was moved to live without ESPN");
  const ran = database.rpcCalls.map((call) => call.name);
  for (const name of ["settle_bowl_pool_missing_picks", "purge_withdrawn_bowl_pool_drafts", "grade_bowl_pool_final_picks", "refresh_bowl_pool_champion"]) assert.ok(ran.includes(name), `${name} still ran`);
});

test("with ESPN answering, the same run succeeds and reports its counts", async () => {
  reset();
  const result = await withEspn(async () => ({ ok: true, json: async () => ({ events: [] }) }), () => syncBowlPool(NOW));
  assert.equal(result.gamesStarted, 1);
  assert.equal(result.finalizedGames, 0);
});
