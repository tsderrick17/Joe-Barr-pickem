import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSchedule } from "../src/lib/schedule-reconciliation.js";

const now = new Date("2026-09-01T12:00:00.000Z");
const base = {
  externalGameId: "game-1", scoringPeriodId: "week-1", awayTeamId: "away",
  homeTeamId: "home", kickoffAt: "2026-09-13T17:00:00.000Z",
  lineLockAt: "2026-09-13T12:00:00.000Z", status: "scheduled",
};

test("an agile schedule refresh applies only unlocked kickoff corrections", () => {
  const result = reconcileSchedule({
    savedGames: [base],
    incomingGames: [{ ...base, kickoffAt: "2026-09-13T18:00:00.000Z", lineLockAt: "2026-09-13T13:00:00.000Z" }],
    evaluatedAt: now,
  });
  assert.equal(result.reschedules.length, 1);
  assert.deepEqual(result.review, []);
});

test("locked, settled, re-paired, and week-crossing changes require review", () => {
  const variants = [
    { ...base, lineLockAt: "2026-08-31T12:00:00.000Z" },
    { ...base, status: "final" },
    { ...base, awayTeamId: "other-away" },
    { ...base, scoringPeriodId: "week-2" },
  ];
  for (const saved of variants) {
    const result = reconcileSchedule({
      savedGames: [saved],
      incomingGames: [{ ...base, kickoffAt: "2026-09-13T18:00:00.000Z", lineLockAt: "2026-09-13T13:00:00.000Z" }],
      evaluatedAt: now,
    });
    assert.equal(result.reschedules.length, 0);
    assert.equal(result.review.length, 1);
  }
});

test("a partial provider response is never treated as a delete instruction", () => {
  const result = reconcileSchedule({
    savedGames: [base], incomingGames: [], evaluatedAt: now,
  });
  assert.equal(result.missingFromProvider.length, 1);
  assert.deepEqual(result.creates, []);
  assert.deepEqual(result.reschedules, []);
});
