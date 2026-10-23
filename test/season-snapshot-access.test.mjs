import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The real Season Snapshot loader with its database scripted: players see nothing until Week 6 has settled, and until then a player's request
// reads only Week 6 itself, never earlier picks. A chart cached for the Commissioner is never handed to a player before the release.
const HOUR = 3_600_000;
const periods = [
  { id: "wk5", display_name: "Week 5", display_order: 5, status: "complete", period_type: "regular", max_picks: 2 },
  { id: "wk6", display_name: "Week 6", display_order: 6, status: "active", period_type: "regular", max_picks: 2 },
  { id: "wk7", display_name: "Week 7", display_order: 7, status: "upcoming", period_type: "regular", max_picks: 2 },
];
const players = [{ id: "al", active: true }, { id: "tyler", active: true }];
const respond = (table, calls) => {
  if (table === "seasons") return { data: { id: "season-1" }, error: null };
  if (table === "scoring_periods") return { data: periods, error: null };
  if (table === "players") return { data: players, error: null };
  if (table === "games") return { data: [{ id: "g1", scoring_period_id: "wk6", kickoff_at: new Date(Date.now() + 24 * HOUR).toISOString() }], error: null };
  if (table === "picks") {
    const ids = calls.find(([name]) => name === "in")?.[1][1] ?? [];
    const rows = [
      { player_id: "al", scoring_period_id: "wk5", game_id: "g0", result: "win" }, { player_id: "al", scoring_period_id: "wk5", game_id: "g0", result: "loss" },
      { player_id: "tyler", scoring_period_id: "wk5", game_id: "g0", result: "loss" }, { player_id: "tyler", scoring_period_id: "wk5", game_id: "g0", result: "loss" },
      { player_id: "al", scoring_period_id: "wk6", game_id: "g1", result: "pending" }, { player_id: "tyler", scoring_period_id: "wk6", game_id: "g1", result: "pending" },
    ];
    return { data: rows.filter((row) => ids.includes(row.scoring_period_id)), error: null };
  }
  throw new Error(`unexpected table ${table}`);
};
let database;
globalThis.snapshotFixture = { supabaseAdmin: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.snapshotFixture.supabaseAdmin[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { loadSeasonSnapshot } = await import("../src/lib/season-snapshot-loader.ts");
const start = () => { database = recordingDatabase(respond); globalThis.snapshotFixture.supabaseAdmin = database; };
const periodsRead = () => database.queries.filter((query) => query.table === "picks").flatMap((query) => query.calls.find(([name]) => name === "in")?.[1][1] ?? []);

test("before Week 6 settles a player gets no chart and only Week 6 is read; the Commissioner always gets one; the cached chart never leaks to a player", async () => {
  start();
  const early = await loadSeasonSnapshot(false);
  assert.deepEqual({ ok: early.ok, released: early.released, payload: early.payload }, { ok: true, released: false, payload: null });
  assert.deepEqual([...new Set(periodsRead())], ["wk6"], "no earlier week's picks were read for a player");

  start();
  const preview = await loadSeasonSnapshot(true);
  assert.equal(preview.ok, true);
  assert.ok(preview.payload, "the Commissioner previews before the release");
  assert.equal(preview.released, false);
  assert.ok(periodsRead().includes("wk5"), "the Commissioner's chart carries the earlier weeks");

  start();
  const after = await loadSeasonSnapshot(false);
  assert.equal(after.payload, null, "the chart cached for the Commissioner is not handed to a player");
});
