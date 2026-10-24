import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// Saving picks, run through the real route with sign-in and the database scripted: a scoring-period read that fails is "try again", never "that week does not exist",
// and a week that does not exist or is finished is refused before anything else is read.
let periodResult, database;
const respond = (table) => {
  if (table === "scoring_periods") return periodResult;
  throw new Error(`the route read ${table} after refusing the week`);
};
globalThis.picksFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.picksFixture.database[name](...args) });", shortCircuit: true };
    if (specifier === "@/lib/authenticate-active-player") return { url: "data:text/javascript,export const authenticateActivePlayer = async () => ({ ok: true, player: { id: 'tyler', active: true, is_commissioner: false } });", shortCircuit: true };
    if (specifier === "@/lib/off-season-gate") return { url: "data:text/javascript,export const refuseWhenSeasonClosed = async () => null;", shortCircuit: true };
    if (specifier === "@/lib/player-activity") return { url: "data:text/javascript,export const recordPlayerActivity = async () => {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { POST } = await import("../src/app/api/picks/route.ts");
const save = async (result) => {
  periodResult = result; database = recordingDatabase(respond); globalThis.picksFixture.database = database;
  const response = await POST(new NextRequest("http://localhost/api/picks", { method: "POST", headers: { authorization: "Bearer token" }, body: JSON.stringify({ scoringPeriodId: "w5", selections: [{ gameId: "g1", teamId: "t1" }] }) }));
  return { status: response.status, body: await response.json() };
};
const periodReads = () => database.queries.filter((query) => query.table === "scoring_periods").length;

test("a failed scoring-period read is answered 503 (try again), not 404 (that week does not exist)", async () => {
  const failed = await save({ data: null, error: { status: 400, message: "bad request" } });
  assert.equal(failed.status, 503);
  assert.match(failed.body.error, /trouble reaching its records/);
  assert.equal(periodReads(), 1, "a permanent error is not retried");
});

test("a transient read failure is retried before the player is told to try again", async () => {
  const failed = await save({ data: null, error: { status: 503, message: "upstream unavailable" } });
  assert.equal(failed.status, 503);
  assert.equal(periodReads(), 3, "tried, and tried twice more");
});

test("a week that does not exist is a 404, and a completed week is read-only", async () => {
  const missing = await save({ data: null, error: null });
  assert.equal(missing.status, 404);
  assert.match(missing.body.error, /could not be found/);
  const complete = await save({ data: { max_picks: 2, season_id: "s1", status: "complete", period_type: "regular" }, error: null });
  assert.equal(complete.status, 400);
  assert.match(complete.body.error, /read-only/);
  assert.equal(periodReads(), 1, "nothing else was read for it");
});
