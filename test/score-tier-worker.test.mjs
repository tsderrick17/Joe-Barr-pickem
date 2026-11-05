import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The score worker's tier handling, run through the real syncFinalScores with its database scripted and the provider's response faked:
// which games it asks the provider about on each tier, what it does with the games it leaves alone, what timer each game ends up on, and what a
// run records. Which tier applies (decideScoreTier) is scripted here; its own decisions are tested in score-polling-tier.test.mjs.
const stub = (code) => ({ url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return stub("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.workerFixture.database[name](...args) });");
    if (specifier === "@/lib/score-tier-plan") return stub("export const decideScoreTier = async () => globalThis.workerFixture.plan();");
    if (specifier === "@/lib/advance-scoring-periods") return stub("export const advanceScoringPeriods = async () => ({ action: 'none' });");
    if (specifier === "@/lib/void-disrupted-picks") return stub("export const voidDisruptedPicks = async () => ({});");
    if (specifier === "@/lib/eliminate-survivor-no-picks") return stub("export const eliminateSurvivorNoPicks = async () => ({ entries_eliminated: 0 });");
    if (specifier === "@/lib/season-rollover") return stub("export const ensureAnnualSeasonRollover = async () => ({});");
    return nextResolve(specifier, context);
  },
});
process.env.ODDS_API_KEY = "fixture-key";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { syncFinalScores } = await import("../src/lib/sync-final-scores.ts");
const { SCORE_LADDER_VERSION } = await import("../src/lib/score-retry-ladder.js");

const MINUTE = 60_000;
const KICKOFF = Date.parse("2026-11-08T18:00:00Z");
const game = { id: "g1", external_game_id: "x1", odds_event_id: "evt1", scoring_period_id: "w9", away_team_id: "tA", home_team_id: "tB", kickoff_at: new Date(KICKOFF).toISOString(), status: "live" };
const planOf = (tier) => ({ tier, message: `${tier} for this test` });
let database, backoffRows, providerCalls, plan, payload;

const run = async (minutesAfterKickoff, { tier = "normal", backoff = [], completed = false, bypass = false, seconds = 4 } = {}) => {
  backoffRows = backoff;
  plan = () => planOf(tier);
  payload = completed ? [{ id: "evt1", completed: true, scores: [{ name: "Away", score: "20" }, { name: "Home", score: "17" }] }] : [{ id: "evt1", completed: false }];
  providerCalls = 0;
  const respond = (table, calls) => {
    const has = (name) => calls.some(([call]) => call === name);
    if (table === "games") return { data: [game], error: null };
    if (table === "scoring_periods") return { data: [], error: null };
    if (table === "score_check_backoff") return { data: backoffRows, error: null };
    if (table === "sync_runs") return has("insert") ? { data: { id: "run-1" }, error: null } : { data: null, error: null };
    if (table === "teams") return { data: [{ id: "tA", full_name: "Away" }, { id: "tB", full_name: "Home" }], error: null };
    if (table === "picks") return { count: 0, data: null, error: null };
    throw new Error(`unexpected table ${table}`);
  };
  database = recordingDatabase(respond, {
    rpc: (name) => {
      if (name === "recover_pending_ats_grades") return { data: [{ picks_graded: 0, picks_awaiting_line: 0 }], error: null };
      if (name === "finalize_games_atomically") return { data: [{ final_scores_imported: 1, ats_picks_graded: 0, survivor_picks_graded: 0 }], error: null };
      return { data: null, error: null };
    },
  });
  globalThis.workerFixture = { database, plan: () => plan() };
  mock.method(globalThis, "fetch", async () => {
    providerCalls += 1;
    return new Response(JSON.stringify(payload), { status: 200, headers: { "x-requests-remaining": "30", "x-requests-used": "470", "x-requests-last": "2" } });
  });
  mock.timers.enable({ apis: ["Date"], now: KICKOFF + minutesAfterKickoff * MINUTE + seconds * 1000 });
  try {
    return await syncFinalScores({ bypassProviderCooldown: bypass });
  } finally {
    mock.timers.reset();
    mock.restoreAll();
  }
};
const upserted = () => database.queries.filter((query) => query.table === "score_check_backoff").flatMap((query) => query.calls.filter(([name]) => name === "upsert").map(([, args]) => args[0])).flat();
const insertedRuns = () => database.queries.filter((query) => query.table === "sync_runs" && query.calls.some(([name]) => name === "insert"));
const minutesOf = (iso) => (Date.parse(iso) - KICKOFF) / MINUTE;
const previous = (attempts, lastCheckedMinutes, nextMinutes) => [{ game_id: "g1", attempts, last_checked_at: new Date(KICKOFF + lastCheckedMinutes * MINUTE).toISOString(), next_check_at: new Date(KICKOFF + nextMinutes * MINUTE).toISOString() }];

test("Normal: the first check asks the provider and sets the next timer five minutes on", async () => {
  const result = await run(175);
  assert.equal(providerCalls, 1);
  assert.equal(result.tier, "normal");
  assert.equal(result.providerChecked, true);
  const [row] = upserted();
  assert.deepEqual([row.attempts, minutesOf(row.next_check_at)], [1, 180]);
});

test("Minimal: at the gate's 175 minutes the game is left alone, with no provider call and no run recorded, and its timer moves to 190", async () => {
  const result = await run(175, { tier: "minimal" });
  assert.equal(providerCalls, 0, "no credits spent");
  assert.equal(insertedRuns().length, 0, "nothing recorded as a score run");
  assert.equal(result.providerChecked, false);
  assert.equal(result.tier, "minimal");
  const [row] = upserted();
  assert.deepEqual([row.attempts, minutesOf(row.next_check_at)], [0, 190], "not counted as a check; due at Minimal's first time");
});

test("Minimal: at 190 the game is checked, and the next timer is Minimal's 210", async () => {
  const result = await run(190, { tier: "minimal", backoff: previous(0, 175, 190) });
  assert.equal(providerCalls, 1);
  assert.equal(result.providerChecked, true);
  const [row] = upserted();
  assert.deepEqual([row.attempts, minutesOf(row.next_check_at)], [1, 210]);
});

test("a game that was on Normal when the tier dropped to Lean is passed over until Lean's next time, keeping its record of the last real check", async () => {
  const result = await run(180, { tier: "lean", backoff: previous(2, 175, 180) });
  assert.equal(providerCalls, 0);
  const [row] = upserted();
  assert.equal(row.attempts, 2, "a pass-over is not a check");
  assert.equal(row.last_checked_at, new Date(KICKOFF + 175 * MINUTE).toISOString(), "and the last real check stays as it was");
  assert.equal(minutesOf(row.next_check_at), 190, "Lean's next time after the 180 tick");
  assert.equal(result.providerChecked, false);
});

test("paused: nothing is asked of the provider, the game is looked at again in an hour, and the run says why", async () => {
  const result = await run(200, { tier: "paused", backoff: previous(5, 195, 200) });
  assert.equal(providerCalls, 0);
  assert.equal(minutesOf(upserted()[0].next_check_at), 260);
  assert.equal(result.tier, "paused");
  assert.deepEqual(result.warnings, ["paused for this test"]);
});

test("the Commissioner's run checks every due game even when polling is paused, and the game then waits an hour", async () => {
  const result = await run(200, { tier: "paused", bypass: true, backoff: previous(5, 195, 400) });
  assert.equal(providerCalls, 1, "the timer and the tier are both ignored");
  assert.equal(result.providerChecked, true);
  assert.equal(minutesOf(upserted()[0].next_check_at), 260);
});

test("a final found on Normal records its place on the list and the plain ladder version, so the rung chart counts it", async () => {
  const result = await run(190, { completed: true, backoff: previous(3, 185, 190) });
  assert.equal(result.newFinals, 1);
  assert.deepEqual(result.finalGameRungs, { g1: 4 }, "the fourth time on Normal's list: 175, 180, 185, 190");
  assert.deepEqual(result.ladderRungs, { 4: 1 });
  assert.equal(result.ladderVersion, SCORE_LADDER_VERSION);
  assert.equal(result.tier, "normal");
});

test("a final found on Minimal carries its own ladder version, so the Normal rung chart leaves it out", async () => {
  const result = await run(210, { tier: "minimal", completed: true, backoff: previous(1, 190, 210) });
  assert.equal(result.newFinals, 1);
  assert.deepEqual(result.finalGameRungs, { g1: 2 }, "the second time on Minimal's list: 190, 210");
  assert.equal(result.ladderVersion, `${SCORE_LADDER_VERSION}:minimal`);
  assert.equal(result.tier, "minimal");
});

test("a failed provider call moves the game to its next time on the tier, like an unfinished one", async () => {
  backoffRows = previous(2, 180, 185);
  await assert.rejects(async () => {
    plan = () => planOf("normal");
    database = recordingDatabase((table, calls) => {
      if (table === "games") return { data: [game], error: null };
      if (table === "scoring_periods") return { data: [], error: null };
      if (table === "score_check_backoff") return { data: backoffRows, error: null };
      if (table === "sync_runs") return calls.some(([name]) => name === "insert") ? { data: { id: "run-1" }, error: null } : { data: null, error: null };
      throw new Error(`unexpected table ${table}`);
    }, { rpc: (name) => (name === "recover_pending_ats_grades" ? { data: [{ picks_graded: 0, picks_awaiting_line: 0 }], error: null } : { data: null, error: null }) });
    globalThis.workerFixture = { database, plan: () => plan() };
    mock.method(globalThis, "fetch", async () => new Response("down", { status: 500 }));
    mock.timers.enable({ apis: ["Date"], now: KICKOFF + 185 * MINUTE + 4000 });
    try { await syncFinalScores(); } finally { mock.timers.reset(); mock.restoreAll(); }
  }, /could not be reached/);
  const [row] = upserted();
  assert.deepEqual([row.attempts, minutesOf(row.next_check_at)], [3, 190]);
});
