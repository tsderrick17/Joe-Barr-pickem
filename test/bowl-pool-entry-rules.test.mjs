import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The Bowl Pool's entry rules, run through the real submit route with its database scripted: entry (and opting out) closes at the first kickoff, a seat already
// held can still choose games that have not kicked off, and a game that has kicked off can no longer be picked.
const FIRST_KICKOFF = "2026-12-20T17:00:00Z";
const GAMES = [
  { id: "past", kickoff_at: FIRST_KICKOFF, status: "scheduled", away_team_id: "a0", home_team_id: "h0" },
  { id: "later", kickoff_at: "2026-12-28T17:00:00Z", status: "scheduled", away_team_id: "a1", home_team_id: "h1" },
  { id: "postponed", kickoff_at: "2026-12-29T17:00:00Z", status: "postponed", away_team_id: "a2", home_team_id: "h2" },
  { id: "cancelled", kickoff_at: "2026-12-30T17:00:00Z", status: "cancelled", away_team_id: "a3", home_team_id: "h3" },
];
let entry = null;
let player = { id: "p1", is_commissioner: false };
let database;
const respond = (table) => {
  if (table === "bowl_pool_seasons") return { data: { id: "season-1", season_year: 2026, first_kickoff_at: FIRST_KICKOFF }, error: null };
  if (table === "bowl_pool_games") return { data: GAMES, error: null };
  if (table === "bowl_pool_entries") return { data: entry, error: null };
  return { data: null, error: null };
};
const start = () => { database = recordingDatabase(respond, { rpc: () => ({ data: "entry-1", error: null }) }); globalThis.bowlRulesFixture.database = database; };
globalThis.bowlRulesFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/authenticate-active-player") return { url: "data:text/javascript,export const authenticateActivePlayer = async () => ({ ok: true, player: globalThis.bowlRulesPlayer() });", shortCircuit: true };
    if (specifier === "@/lib/off-season-gate") return { url: "data:text/javascript,export const refuseWhenSeasonClosed = async () => null;", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlRulesFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
globalThis.bowlRulesPlayer = () => player;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { POST } = await import("../src/app/api/bowl-pool/route.ts");
const submit = async (now, body) => {
  start();
  mock.timers.enable({ apis: ["Date"], now: Date.parse(now) });
  try {
    const response = await POST(new NextRequest("http://localhost/api/bowl-pool", { method: "POST", body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  } finally { mock.timers.reset(); }
};
const choose = (gameId, teamId) => ({ optedIn: true, selections: [{ gameId, teamId, side: "favorite" }], championshipTotalGuess: 48 });
const saved = () => database.rpcCalls.filter((call) => call.name === "save_bowl_pool_submission");

test("before the first kickoff a player can claim a seat, choose an open game, and opt out", async () => {
  entry = null;
  const joined = await submit("2026-12-12T15:00:00Z", choose("later", "a1"));
  assert.equal(joined.status, 200);
  assert.equal(saved().length, 1);
  assert.deepEqual(saved()[0].args.target_selections, [{ game_id: "later", team_id: "a1" }]);
  entry = { id: "entry-1", status: "active" };
  const out = await submit("2026-12-12T15:00:00Z", { optedIn: false, selections: [], championshipTotalGuess: null });
  assert.equal(out.status, 200);
  assert.ok(database.queries.some((query) => query.table === "bowl_pool_entries" && query.calls.some(([name, args]) => name === "update" && args[0].status === "withdrawn")), "the entry is withdrawn");
});

test("after the first kickoff a newcomer is turned away and a seat holder can no longer opt out", async () => {
  entry = null;
  const late = await submit("2026-12-21T12:00:00Z", choose("later", "a1"));
  assert.equal(late.status, 409);
  assert.equal(saved().length, 0, "nothing is saved for a late newcomer");
  entry = { id: "entry-1", status: "active" };
  const out = await submit("2026-12-21T12:00:00Z", { optedIn: false, selections: [], championshipTotalGuess: null });
  assert.equal(out.status, 409);
  entry = { id: "entry-1", status: "withdrawn" };
  assert.equal((await submit("2026-12-21T12:00:00Z", choose("later", "a1"))).status, 409, "a withdrawn seat cannot come back after the first kickoff");
});

test("a seat holder can still choose a game that has not kicked off, but not one that has", async () => {
  entry = { id: "entry-1", status: "active" };
  const open = await submit("2026-12-21T12:00:00Z", choose("later", "h1"));
  assert.equal(open.status, 200);
  assert.deepEqual(saved()[0].args.target_selections, [{ game_id: "later", team_id: "h1" }]);
  const closed = await submit("2026-12-21T12:00:00Z", choose("past", "a0"));
  assert.equal(closed.status, 400);
  assert.equal(saved().length, 0, "a game that has kicked off is never saved");
});

test("a selection must be one of the teams in that game", async () => {
  entry = { id: "entry-1", status: "active" };
  const wrong = await submit("2026-12-12T15:00:00Z", choose("later", "a0"));
  assert.equal(wrong.status, 400);
  assert.equal(saved().length, 0);
});

test("a pick sent for a postponed or cancelled game is left out, not a reason to refuse the rest of the Submit", async () => {
  entry = { id: "entry-1", status: "active" };
  const response = await submit("2026-12-21T12:00:00Z", {
    optedIn: true, championshipTotalGuess: 48,
    selections: [{ gameId: "later", teamId: "h1", side: "favorite" }, { gameId: "postponed", teamId: "a2", side: "favorite" }, { gameId: "cancelled", teamId: "h3", side: "underdog" }],
  });
  assert.equal(response.status, 200);
  assert.deepEqual(saved()[0].args.target_selections, [{ game_id: "later", team_id: "h1" }], "only the open game is saved");
  assert.equal(response.body.saved, 1, "and the answer counts what was saved");
});
