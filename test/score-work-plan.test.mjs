import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { pollingModeFor, selectDueGames, selectEligibleGames } = await import("../src/lib/score-work-plan.ts");

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
