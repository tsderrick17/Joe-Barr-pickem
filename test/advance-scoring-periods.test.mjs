import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The weekly handoff, run through the real function with its database scripted: the earliest due period opens first, a week does not roll over until every game is
// settled and every Pick'em and Survivor pick is graded, and then it waits for the scheduled handoff time before completing.
let periods, games, nextGames, pendingPicks, pendingSurvivor, activation;
const respond = (table, calls) => {
  const has = (name) => calls.some(([call]) => call === name);
  if (table === "seasons") return { data: { id: "season-1" }, error: null };
  if (table === "scoring_periods") return { data: periods, error: null };
  if (table === "games") return { data: has("limit") ? nextGames : games, error: null };
  if (table === "picks") return { count: pendingPicks, data: null, error: null };
  if (table === "survivor_picks") return { count: pendingSurvivor, data: null, error: null };
  throw new Error(`unexpected table ${table}`);
};
let database;
globalThis.advanceFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.advanceFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { advanceScoringPeriods } = await import("../src/lib/advance-scoring-periods.ts");
const { weekRolloverAt } = await import("../src/lib/week-rollover.js");
const FINAL = "2026-10-12T04:30:00Z", NEXT_KICKOFF = "2026-10-18T17:00:00Z";
const ROLLOVER = weekRolloverAt({ lastFinalizedAt: FINAL, nextKickoffAt: NEXT_KICKOFF });
const week = (order, status, startsAt = "2026-09-01T00:00:00Z") => ({ id: `w${order}`, display_name: `Week ${order}`, display_order: order, status, starts_at: startsAt });
const settled = () => [{ id: "g1", kickoff_at: "2026-10-12T00:30:00Z", status: "final", finalized_at: FINAL }];
const run = async (now) => {
  database = recordingDatabase(respond, { rpc: (name) => (name === "activate_scoring_period_atomically" ? { data: [activation], error: null } : { data: null, error: null }) });
  globalThis.advanceFixture.database = database;
  return advanceScoringPeriods(new Date(now));
};
const setup = (over = {}) => {
  periods = over.periods ?? [week(5, "active"), week(6, "upcoming", "2026-10-14T07:00:00Z")];
  games = over.games ?? settled();
  nextGames = [{ kickoff_at: NEXT_KICKOFF }];
  pendingPicks = over.pendingPicks ?? 0;
  pendingSurvivor = over.pendingSurvivor ?? 0;
  activation = over.activation ?? { activated: true, blocked_reason: null };
};

test("with no active week, the earliest due period is opened through the database, never a later one", async () => {
  setup({ periods: [week(3, "complete"), week(4, "upcoming", "2026-09-20T00:00:00Z"), week(5, "upcoming", "2026-09-27T00:00:00Z"), week(6, "upcoming", "2099-01-01T00:00:00Z")] });
  const result = await run("2026-10-14T12:00:00Z");
  assert.equal(result.action, "activated");
  assert.equal(result.currentWeek, "Week 4");
  assert.deepEqual(database.rpcCalls.map((call) => [call.name, call.args.target_scoring_period_id]), [["activate_scoring_period_atomically", "w4"]]);
});

test("when the database refuses to open the period, the answer is blocked with its reason and nothing is activated by hand", async () => {
  setup({ periods: [week(4, "upcoming", "2026-09-20T00:00:00Z")], activation: { activated: false, blocked_reason: "An earlier scoring period has not been completed." } });
  const result = await run("2026-10-14T12:00:00Z");
  assert.deepEqual({ action: result.action, reason: result.reason }, { action: "blocked", reason: "An earlier scoring period has not been completed." });
  assert.ok(!database.queries.some((query) => query.table === "scoring_periods" && query.calls.some(([name]) => name === "update")));
});

test("a week with an unsettled game waits; pending Pick'em picks or pending Survivor picks block the handoff", async () => {
  setup({ games: [{ id: "g1", kickoff_at: "2026-10-12T00:30:00Z", status: "live", finalized_at: null }] });
  assert.equal((await run("2026-10-14T12:00:00Z")).action, "waiting");
  setup({ pendingPicks: 2 });
  const picks = await run("2026-10-14T12:00:00Z");
  assert.deepEqual({ action: picks.action, reason: picks.reason }, { action: "blocked", reason: "Final-game picks still need an official line or grade." });
  setup({ pendingSurvivor: 1 });
  const survivor = await run("2026-10-14T12:00:00Z");
  assert.deepEqual({ action: survivor.action, reason: survivor.reason }, { action: "blocked", reason: "Survivor picks still need a final grade or audited void." });
  assert.equal(database.rpcCalls.length, 0, "a blocked week is never completed");
});

test("a postponed game holds the handoff with a reason, and nothing is sent to the database to complete the week", async () => {
  const postponed = { id: "g2", kickoff_at: "2026-10-12T00:30:00Z", status: "postponed", finalized_at: null };
  setup({ games: [...settled(), postponed] });
  const held = await run(new Date(Date.parse(ROLLOVER) + 60_000).toISOString());
  assert.deepEqual({ action: held.action, rolloverAt: held.rolloverAt }, { action: "blocked", rolloverAt: null });
  assert.match(held.reason, /postponed game is still open/);
  assert.equal(database.rpcCalls.length, 0, "the week is not completed while a game is postponed");
  // Recorded as cancelled, the same week is settled and completes at its handoff time.
  setup({ games: [...settled(), { ...postponed, status: "cancelled" }] });
  const released = await run(new Date(Date.parse(ROLLOVER) + 60_000).toISOString());
  assert.equal(released.action, "completed");
  assert.deepEqual(database.rpcCalls.map((call) => call.name), ["complete_scoring_period_atomically"]);
});

test("a fully graded week keeps showing until the scheduled handoff time, then completes into the next week", async () => {
  setup();
  const early = await run(new Date(Date.parse(ROLLOVER) - 60_000).toISOString());
  assert.deepEqual({ action: early.action, rolloverAt: early.rolloverAt }, { action: "waiting", rolloverAt: ROLLOVER });
  assert.equal(database.rpcCalls.length, 0);
  const due = await run(new Date(Date.parse(ROLLOVER) + 60_000).toISOString());
  assert.equal(due.action, "completed");
  assert.deepEqual(database.rpcCalls.map((call) => [call.name, call.args.target_scoring_period_id, call.args.next_scoring_period_id]), [["complete_scoring_period_atomically", "w5", "w6"]]);
});
