import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The last-resort final entry: the route hands the typed scores and the verification note to the one database function that grades them, answers what was
// graded, and passes the database's refusal on in plain words; the exceptions list offers only games past the score provider's three-day window.
globalThis.verifiedFinalFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/supabase-admin") return shim("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.verifiedFinalFixture.database[name](...args) });");
    if (specifier === "@/lib/require-commissioner") return shim("export const commissionerAccess = async () => ({ ok: true, player: { id: 'commissioner-1', first_name: 'Tyler', is_commissioner: true } });");
    if (specifier === "next/server") return { url: new URL("./helpers/next-server-stub.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier === "server-only") return shim("export {};");
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { POST } = await import("../src/app/api/admin/verified-final/route.ts");
const exceptions = await import("../src/app/api/admin/game-exceptions/route.ts");

const send = (body) => new Request("http://localhost/api/admin/verified-final", { method: "POST", headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: JSON.stringify(body) });
const GOOD = { gameId: "g1", awayScore: 20, homeScore: 17, source: "  NFL.com box score " };

test("a typed final goes to the database function with the Commissioner's id, and the answer says what was graded", async () => {
  const database = recordingDatabase(() => ({ data: [], error: null }), {
    rpc: () => ({ data: [{ final_scores_imported: 1, ats_picks_graded: 3, survivor_picks_graded: 1 }], error: null }),
  });
  verifiedFinalFixture.database = database;
  const response = await POST(send(GOOD));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: "Final saved: 20 to 17. 3 ATS and 1 Survivor pick graded." });
  assert.deepEqual(database.rpcCalls, [{
    name: "record_verified_final",
    args: { target_game_id: "g1", verified_away_score: 20, verified_home_score: 17, verification_source: "NFL.com box score", actor_player_id: "commissioner-1" },
  }]);
  assert.equal(database.queries.length, 0, "the grading is the one function; the route writes nothing itself");
});

test("the database's refusal reaches the Commissioner as a 400 with its own words", async () => {
  verifiedFinalFixture.database = recordingDatabase(() => ({ data: [], error: null }), {
    rpc: () => ({ data: null, error: { message: "A final can be entered by hand only after the score provider's three-day window has passed." } }),
  });
  const response = await POST(send(GOOD));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /three-day window/);
});

test("an incomplete form never reaches the database", async () => {
  const database = recordingDatabase(() => ({ data: [], error: null }));
  verifiedFinalFixture.database = database;
  for (const bad of [{ ...GOOD, source: "   " }, { ...GOOD, awayScore: "20" }, { ...GOOD, homeScore: null }, { gameId: "g1" }]) {
    assert.equal((await POST(send(bad))).status, 400, JSON.stringify(bad));
  }
  assert.equal(database.rpcCalls.length, 0);
});

test("the exceptions list offers a hand-entered final only for games past the provider's three-day window", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-04T18:30:00Z") });
  try {
    const game = (id, kickoff) => ({ id, away_team_id: "t1", home_team_id: "t2", scoring_period_id: "p1", kickoff_at: kickoff });
    const recordable = [
      game("old", "2026-09-28T17:00:00Z"),
      game("edge", "2026-10-01T18:00:00Z"),
      game("recent", "2026-10-02T17:00:00Z"),
      game("future", "2026-10-11T17:00:00Z"),
    ];
    verifiedFinalFixture.database = recordingDatabase((table, calls) => {
      if (table === "picks") return { data: [], error: null };
      if (table === "teams") return { data: [{ id: "t1", full_name: "Cleveland Browns" }, { id: "t2", full_name: "Pittsburgh Steelers" }], error: null };
      if (table === "scoring_periods") return { data: [{ id: "p1", display_name: "Week 4" }], error: null };
      const statuses = calls.find(([name]) => name === "in")?.[1][1] ?? [];
      return { data: statuses.includes("scheduled") ? recordable : [], error: null };
    });
    const response = await exceptions.GET(new Request("http://localhost/api/admin/game-exceptions", { headers: { authorization: "Bearer fixture" } }));
    const body = await response.json();
    assert.deepEqual(body.recordableGames.map((game) => game.id), ["old", "edge", "recent", "future"]);
    assert.deepEqual(body.manualFinalGames.map((game) => game.id), ["old", "edge"], "kickoff at least three days ago; the edge game is exactly three days and thirty minutes back");
  } finally {
    mock.timers.reset();
  }
});
