import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";
import { chooseScoreTier, isTierCheckDue, ladderVersionForTier, LINE_NEED_CUSHION_CREDITS, LOW_BALANCE_USED_CREDITS, nextScoreCheckTime, nextTierCheckMs, tierCheckTimes, tierRung } from "../src/lib/score-polling-tier.js";
import { monthlyCreditSeries } from "../src/lib/provider-chart-data.js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: `data:text/javascript,${encodeURIComponent("export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.tierFixture.database[name](...args) });")}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { decideScoreTier } = await import("../src/lib/score-tier-plan.ts");

const MINUTE = 60_000;
const KICKOFF = Date.parse("2026-11-08T18:00:00Z");

// --- The tier rule (pure) ---------------------------------------------------------------------------------------------------------------
const needs = { lineNeedCredits: 15, leanNeedCredits: 40, minimalNeedCredits: 25, gameDaysLeft: 3 };
const choose = (usedCredits, extra = {}) => chooseScoreTier({ usedCredits, remainingCredits: 500 - usedCredits, ...needs, ...extra });

test("Normal, whatever the forecast says, until 440 credits are used; from 440 on, never Normal again that month", () => {
  assert.equal(LOW_BALANCE_USED_CREDITS, 440);
  for (const used of [0, 100, 300, 438, 439]) assert.equal(choose(used, { leanNeedCredits: 9999, minimalNeedCredits: 9999 }).tier, "normal", `${used} used`);
  for (const used of [440, 441, 460, 480]) assert.notEqual(choose(used).tier, "normal", `${used} used`);
});

test("from 440 used: Lean if its forecast fits in what is left after the lines, otherwise Minimal, and paused only when nothing is left after the lines", () => {
  // 500 - 440 = 60 left, 15 for lines: 45 spendable. Lean needs 40: fits.
  assert.deepEqual([choose(440).tier, choose(440).spendableCredits], ["lean", 45]);
  // 5 fewer credits: 40 spendable, Lean needs exactly 40: still fits (a tie goes to the faster tier).
  assert.equal(choose(445).tier, "lean");
  // One more credit used and Lean no longer fits; Minimal (25) does.
  assert.deepEqual([choose(446).tier, choose(446).spendableCredits], ["minimal", 39]);
  // Minimal keeps running even when it does not fit, as long as something is left after the lines: never a hard stop.
  assert.deepEqual([choose(480).tier, choose(480).spendableCredits], ["minimal", 5]);
  assert.equal(choose(485).tier, "paused", "the balance has reached the line need");
  assert.equal(choose(499).tier, "paused");
  assert.equal(choose(484).tier, "minimal");
});

test("it is decided afresh every run, so it steps back up from Minimal to Lean as the game days pass", () => {
  const heavy = choose(446, { leanNeedCredits: 40, gameDaysLeft: 3 });
  const lighter = choose(446, { leanNeedCredits: 12, lineNeedCredits: 8, gameDaysLeft: 1 });
  assert.deepEqual([heavy.tier, lighter.tier], ["minimal", "lean"]);
});

test("no reading of the month's usage means Normal, and the messages say why in plain words", () => {
  assert.equal(chooseScoreTier({ usedCredits: null, remainingCredits: null, ...needs }).tier, "normal");
  assert.match(chooseScoreTier({ usedCredits: null, remainingCredits: null, ...needs }).message, /no credit reading yet this month/);
  assert.match(choose(300).message, /^Normal: 300 credits used\. Slower checking would start at 440\.$/);
  assert.match(choose(440).message, /^Lean: 45 credits are free for scores after the lines, and Lean needs about 40 credits for the 3 game days left\.$/);
  assert.match(choose(460).message, /^Minimal: 25 credits are free for scores after the lines, and Lean would need about 40 credits/);
  assert.match(choose(490).message, /^Paused: 10 credits left and the rest of the month's official lines need about 15 credits\. The Run score check now button still works\.$/);
  assert.match(choose(440, { gameDaysLeft: 1, leanNeedCredits: 70 }).message, /for the 1 game day left\./);
});

// --- The tier's times (pure) ---------------------------------------------------------------------------------------------------------------
test("a kickoff off the five-minute grid rounds each time up to the next tick, and the times stay in order and distinct", () => {
  const offGrid = KICKOFF + 2 * MINUTE; // 6:02 PM
  for (const tier of ["normal", "lean", "minimal"]) {
    const times = tierCheckTimes(tier, offGrid);
    assert.ok(times.every((time) => time % (5 * MINUTE) === 0), `${tier}: on the clock`);
    assert.ok(times.every((time, index) => index === 0 || time > times[index - 1]), `${tier}: strictly increasing`);
  }
  assert.equal((tierCheckTimes("normal", offGrid)[0] - KICKOFF) / MINUTE, 180, "175 + 2 rounds up to 180");
});

test("a game is due at its first time and not a minute before, and then only at the next time on the list after its last check", () => {
  assert.equal(isTierCheckDue("normal", KICKOFF, null, KICKOFF + 175 * MINUTE - 1), false);
  assert.equal(isTierCheckDue("normal", KICKOFF, null, KICKOFF + 175 * MINUTE), true);
  assert.equal(isTierCheckDue("minimal", KICKOFF, null, KICKOFF + 175 * MINUTE), false, "Minimal starts at 190");
  assert.equal(isTierCheckDue("minimal", KICKOFF, null, KICKOFF + 190 * MINUTE), true);
  // Checked at 180:04 (the 180 tick): the 185 time is next, not 180 again.
  const last = KICKOFF + 180 * MINUTE + 4000;
  assert.equal(isTierCheckDue("normal", KICKOFF, last, KICKOFF + 180 * MINUTE + 20_000), false);
  assert.equal(isTierCheckDue("normal", KICKOFF, last, KICKOFF + 185 * MINUTE), true);
  // After the list's last time nothing is ever due.
  assert.equal(isTierCheckDue("minimal", KICKOFF, KICKOFF + 670 * MINUTE, KICKOFF + 100_000 * MINUTE), false);
  assert.equal(nextTierCheckMs("minimal", KICKOFF, KICKOFF + 670 * MINUTE), null);
});

test("a check's rung is its place on the tier's list, never below 1, and the ladder version separates the tiers", () => {
  assert.deepEqual([175, 180, 190, 710].map((minutes) => tierRung("normal", KICKOFF, KICKOFF + minutes * MINUTE + 4000)), [1, 2, 4, 16]);
  assert.equal(tierRung("normal", KICKOFF, KICKOFF + 100 * MINUTE), 1, "a manual run before the first time is still the first window");
  assert.equal(tierRung("minimal", KICKOFF, KICKOFF + 230 * MINUTE), 3);
  assert.deepEqual(["normal", "lean", "minimal"].map((tier) => ladderVersionForTier("v1", tier)), ["v1", "v1:lean", "v1:minimal"]);
});

test("the next time after the last one is as far out as polling itself ends, and a paused game is looked at again in an hour", () => {
  const afterLast = KICKOFF + 710 * MINUTE + 4000;
  assert.equal(nextScoreCheckTime("normal", KICKOFF, afterLast), new Date(KICKOFF + 710 * MINUTE + 72 * 60 * MINUTE).toISOString());
  assert.equal(nextScoreCheckTime("paused", KICKOFF, KICKOFF + 200 * MINUTE + 4000), new Date(KICKOFF + 260 * MINUTE).toISOString());
});

// --- The forecast prices the rest of the month with the tiers the rule would pick -------------------------------------------------------------------
const game = (iso) => ({ kickoff_at: iso });
// Thanksgiving week 2026: Thursday three slates, Sunday two (the late Sunday game is on Eastern Sunday too).
const NOV = [game("2026-11-26T17:30:00Z"), game("2026-11-26T21:30:00Z"), game("2026-11-27T01:20:00Z"), game("2026-11-29T18:00:00Z"), game("2026-11-29T21:25:00Z"), game("2026-11-30T01:20:00Z")];
const usage = (used, at = "2026-11-26T11:00:00Z") => ({ job_type: "scores", status: "success", started_at: at, completed_at: at, details: { providerChecked: true, requestsUsed: String(used), requestsRemaining: String(500 - used), requestsLast: "2" } });
const planAt = (now, used, games = NOV, runAt) => monthlyCreditSeries([usage(used, runAt)], new Date(now), games).tierPlan;

test("the end-of-November squeeze: 439 used is still Normal, 440 is Lean, a few credits lower is Minimal, and the last credits pause", () => {
  const picked = Object.fromEntries([439, 440, 450, 455, 480, 490].map((used) => [used, planAt("2026-11-26T12:00:00Z", used).tier]));
  assert.deepEqual(picked, { 439: "normal", 440: "lean", 450: "lean", 455: "minimal", 480: "minimal", 490: "paused" });
  const plan = planAt("2026-11-26T12:00:00Z", 455);
  assert.equal(plan.gameDaysLeft, 2);
  assert.ok(plan.leanNeedCredits > plan.minimalNeedCredits && plan.minimalNeedCredits > 0, "Lean costs more than Minimal");
  assert.ok(plan.lineNeedCredits >= LINE_NEED_CUSHION_CREDITS, "the lines for the rest of the month plus the cushion");
  assert.equal(plan.spendableCredits, 45 - plan.lineNeedCredits);
});

test("with the heavy days behind it, the same balance steps back up from Minimal to Lean", () => {
  const monday = [game("2026-11-30T17:00:00Z")];
  assert.equal(planAt("2026-11-26T12:00:00Z", 455).tier, "minimal");
  assert.equal(planAt("2026-11-29T23:00:00Z", 455, monday, "2026-11-29T22:00:00Z").tier, "lean");
});

test("a credit reading from last month counts as no reading: the first day of a new month is Normal", () => {
  const plan = planAt("2026-12-01T00:10:00Z", 492, [game("2026-12-03T01:15:00Z")], "2026-11-30T23:00:00Z");
  assert.equal(plan.tier, "normal");
  assert.equal(plan.reportedThisMonth, false);
});

test("the month's forecast prices score checks on the lighter tiers once the rule would use them, and says so", () => {
  const normal = monthlyCreditSeries([usage(300)], new Date("2026-11-26T12:00:00Z"), NOV);
  const squeezed = monthlyCreditSeries([usage(455)], new Date("2026-11-26T12:00:00Z"), NOV);
  const scores = (series) => series.calendarDays.reduce((sum, day) => sum + day.forecastScores, 0);
  assert.ok(scores(squeezed) < scores(normal) / 2, "Minimal checks cost far less than Normal's");
  // Thanksgiving is priced on Minimal; by Sunday the rule would have stepped back up to Lean, and the forecast follows it.
  assert.deepEqual(squeezed.calendarDays.filter((day) => day.forecastSlates > 0).map((day) => [day.date.slice(8, 10), day.forecastTier]), [["26", "minimal"], ["29", "lean"]]);
  assert.match(squeezed.forecastAssumptions, /Past 440 credits used the forecast prices score checks on the Minimal and Lean schedules, as the low-balance rule would/);
  assert.doesNotMatch(normal.forecastAssumptions, /Past 440/);
  assert.equal(normal.tierPlan.tier, "normal");
});

// --- Reading the tier for the worker ---------------------------------------------------------------------------------------------------------
const providerRuns = (used, at) => [{ details: { requestsUsed: String(used), requestsRemaining: String(500 - used) }, completed_at: at, started_at: at }];

test("under 440 used, or with no reading this month, the worker reads one small thing and answers Normal", async () => {
  globalThis.tierFixture = { database: recordingDatabase(() => ({ data: providerRuns(300, "2026-11-26T11:00:00Z"), error: null })) };
  const plan = await decideScoreTier(new Date("2026-11-26T12:00:00Z"));
  assert.equal(plan.tier, "normal");
  assert.equal(globalThis.tierFixture.database.queries.length, 1, "the last provider runs, nothing else");
  globalThis.tierFixture = { database: recordingDatabase(() => ({ data: providerRuns(490, "2026-10-31T23:00:00Z"), error: null })) };
  assert.equal((await decideScoreTier(new Date("2026-11-01T00:10:00Z"))).tier, "normal", "a reading from October is no reading");
  assert.equal(globalThis.tierFixture.database.queries.length, 1);
});

test("from 440 used the worker prices the rest of the month from this month's provider calls and the schedule, as the Commissioner's chart does", async () => {
  const month = [usage(455, "2026-11-26T11:00:00Z")];
  globalThis.tierFixture = {
    database: recordingDatabase((table, calls) => {
      if (table === "sync_runs") return { data: calls.some(([name]) => name === "limit") ? providerRuns(455, "2026-11-26T11:00:00Z") : month, error: null };
      if (table === "games") return { data: NOV, error: null };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  const plan = await decideScoreTier(new Date("2026-11-26T12:00:00Z"));
  assert.equal(plan.tier, "minimal");
  assert.deepEqual(plan, { ...planAt("2026-11-26T12:00:00Z", 455), reportedThisMonth: true }, "the same answer the Performance tab shows");
});

test("a reading the caller already has is used as it is, with no extra look at the provider runs", async () => {
  globalThis.tierFixture = { database: recordingDatabase(() => ({ data: [], error: null })) };
  const reading = { used: 100, remaining: 400, reportedAt: "2026-11-26T11:00:00Z" };
  assert.equal((await decideScoreTier(new Date("2026-11-26T12:00:00Z"), reading)).tier, "normal");
  assert.equal(globalThis.tierFixture.database.queries.length, 0);
});
