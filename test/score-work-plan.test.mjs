import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { decideQuotaHold, parseCreditHeader, pollingModeFor, selectDueGames, selectEligibleGames } = await import("../src/lib/score-work-plan.ts");

// 4:30 PM Eastern on a Sunday. A 1:00 PM game kicked off 3.5 hours ago; a 4:25 PM game five minutes ago.
const NOW = new Date("2026-10-04T20:30:00Z");
const game = (id, kickoffAt, extra = {}) => ({ id, scoring_period_id: "week-5", kickoff_at: kickoffAt, status: "scheduled", ...extra });
const early = game("early", "2026-10-04T17:00:00Z");
const late = game("late", "2026-10-04T20:25:00Z");
const notStarted = game("later", "2026-10-04T23:20:00Z");
const backoff = (gameId, attempts, nextCheckAt) => [gameId, { game_id: gameId, attempts, next_check_at: nextCheckAt }];

test("only games that kicked off long enough ago are due a score check", () => {
  const due = selectDueGames([early, late, notStarted], NOW).map((item) => item.id);
  assert.ok(due.includes("early"), "a game from 3.5 hours ago is due");
  assert.ok(!due.includes("later"), "a game that has not kicked off is never due");
  assert.ok(!due.includes("late"), "a game five minutes in is not due yet");
});

test("a game's own retry timer holds it back, unless a Commissioner recovery bypasses the timers", () => {
  const backoffs = new Map([backoff("early", 2, "2026-10-04T21:00:00Z")]);
  assert.deepEqual(selectEligibleGames([early], backoffs, NOW, false), []);
  assert.deepEqual(selectEligibleGames([early], backoffs, NOW, true).map((item) => item.id), ["early"]);
  // At the timer's instant it is eligible, and a game with no timer always is.
  assert.equal(selectEligibleGames([early], new Map([backoff("early", 2, NOW.toISOString())]), NOW, false).length, 1);
  assert.equal(selectEligibleGames([early], new Map(), NOW, false).length, 1);
});

test("the cadence is the playoff one as soon as any eligible game is in a playoff round", () => {
  const regular = pollingModeFor([early], new Set());
  const playoff = pollingModeFor([early, game("p", "2027-01-10T18:00:00Z", { scoring_period_id: "wild-card" })], new Set(["wild-card"]));
  assert.notEqual(regular, playoff);
  assert.equal(pollingModeFor([], new Set(["wild-card"])), regular);
});

test("credit headers are read as whole non-negative numbers, and anything else is unknown", () => {
  assert.equal(parseCreditHeader("123"), 123);
  assert.equal(parseCreditHeader(40), 40);
  for (const bad of [-1, "-1", "12.5", "abc", "", null, undefined, NaN, {}]) assert.equal(parseCreditHeader(bad), null, String(bad));
});

const run = (remaining, completedAt) => ({ details: { requestsRemaining: remaining }, completed_at: completedAt, started_at: completedAt });

test("the paid provider is held only when every eligible game is a repeated delay and the allowance is low and recent", () => {
  const delayed = new Map([backoff("early", 3, "2026-10-04T20:00:00Z")]);
  const recent = [run("20", "2026-10-04T20:20:00Z")];
  assert.equal(decideQuotaHold({ eligibleGames: [early], backoffByGameId: delayed, recentProviderRuns: recent, now: NOW }).hold, true);
  assert.equal(decideQuotaHold({ eligibleGames: [early], backoffByGameId: delayed, recentProviderRuns: recent, now: NOW }).creditsRemaining, 20);
  // A fresh game (never retried) is always asked about, however low the allowance.
  assert.equal(decideQuotaHold({ eligibleGames: [early], backoffByGameId: new Map(), recentProviderRuns: recent, now: NOW }).hold, false);
  // A comfortable allowance does not hold.
  assert.equal(decideQuotaHold({ eligibleGames: [early], backoffByGameId: delayed, recentProviderRuns: [run("4000", "2026-10-04T20:20:00Z")], now: NOW }).hold, false);
  // No eligible games, or no usable report of the allowance, never holds.
  assert.equal(decideQuotaHold({ eligibleGames: [], backoffByGameId: delayed, recentProviderRuns: recent, now: NOW }).hold, false);
  assert.equal(decideQuotaHold({ eligibleGames: [early], backoffByGameId: delayed, recentProviderRuns: [{ details: null, completed_at: null, started_at: null }], now: NOW }).hold, false);
});

test("the newest report of the allowance is the one used", () => {
  const delayed = new Map([backoff("early", 3, "2026-10-04T20:00:00Z")]);
  const runs = [run("30", "2026-10-04T20:20:00Z"), run("5000", "2026-10-03T20:20:00Z")];
  assert.equal(decideQuotaHold({ eligibleGames: [early], backoffByGameId: delayed, recentProviderRuns: runs, now: NOW }).creditsRemaining, 30);
});
