import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The Commissioner's Bowl readiness page, run for real over a scripted database: its "cron health" tile must read the Bowl worker (bowl_scores),
// not the NFL jobs, and games out of kickoff order must show as a warning without turning the integrity tile red.
const day = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const game = (id, days, order) => ({ id, kickoff_at: day(days), order_index: order, status: "scheduled", away_team_id: "a", home_team_id: "b", bowl_name: id, is_cfp: false });
let games; let heartbeats; let database;
const respond = (table) => {
  if (table === "bowl_pool_seasons") return { data: { id: "season-1", season_year: 2026, player_visible_at: day(-3), first_kickoff_at: null }, error: null };
  if (table === "bowl_pool_games") return { data: games, error: null };
  if (table === "bowl_pool_game_lines") return { data: games.map((item) => ({ game_id: item.id, source: "ESPN", locked_at: null })), error: null };
  if (table === "automation_worker_heartbeats") return { data: heartbeats, error: null };
  if (table === "bowl_pool_schedule_changes") return { count: 0, data: null, error: null };
  return { data: [], error: null };
};
globalThis.bowlReadinessFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/supabase-admin") return shim("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlReadinessFixture.database[name](...args) });");
    if (specifier === "@/lib/require-commissioner") return shim("export const commissionerAccess = async () => ({ ok: true });");
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { GET } = await import("../src/app/api/admin/bowl-pool-readiness/route.ts");
const read = async () => { database = recordingDatabase(respond); bowlReadinessFixture.database = database; return (await GET(new NextRequest("http://localhost/api/admin/bowl-pool-readiness"))).json(); };

test("cron health reads the Bowl worker's heartbeat only, and a failed or missing-success run shows as attention", async () => {
  games = [game("one", 10, 1), game("two", 11, 2)];
  for (const [status, expected] of [["success", "healthy"], ["skipped", "healthy"], ["failed", "attention"], ["started", "attention"]]) {
    heartbeats = [{ job_name: "bowl_scores", last_status: status }];
    assert.equal((await read()).cronHealth, expected, status);
  }
  const query = database.queries.find((item) => item.table === "automation_worker_heartbeats");
  assert.deepEqual(query.calls.find(([name]) => name === "eq")[1], ["job_name", "bowl_scores"], "the NFL jobs are not consulted");
});

test("games out of kickoff order are a warning on the integrity tile, not a failure", async () => {
  heartbeats = [{ job_name: "bowl_scores", last_status: "success" }];
  games = [game("one", 10, 1), game("two", 11, 2)];
  const inOrder = await read();
  assert.deepEqual({ healthy: inOrder.integrity.healthy, warnings: inOrder.integrity.warnings }, { healthy: true, warnings: [] });
  games = [game("one", 11, 1), game("two", 10, 2)];
  const swapped = await read();
  assert.deepEqual({ healthy: swapped.integrity.healthy, warnings: swapped.integrity.warnings, problems: swapped.integrity.problems }, { healthy: true, warnings: ["Bowl Pool games are not in chronological order."], problems: [] });
});
