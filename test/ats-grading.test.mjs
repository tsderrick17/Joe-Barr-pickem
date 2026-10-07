import test from "node:test";
import assert from "node:assert/strict";
import { gradeAtsPick } from "../src/lib/ats-grading.js";
import { isDueForFinalScoreCheck } from "../src/lib/score-window.js";
import { atsGradingScenarios } from "./fixtures/ats-grading-scenarios.mjs";

test("ATS grading matches the independently specified shared scenario matrix", () => {
  for (const { name, pick, expected } of atsGradingScenarios) {
    assert.equal(gradeAtsPick(pick), expected, name);
  }
});

test("begins final-score checks two hours and fifty minutes after kickoff", () => {
  const game = { kickoffAt: "2026-09-13T17:00:00.000Z", status: "scheduled" };

  assert.equal(
    isDueForFinalScoreCheck(game, new Date("2026-09-13T19:49:59.000Z")),
    false,
  );
  assert.equal(
    isDueForFinalScoreCheck(game, new Date("2026-09-13T19:50:00.000Z")),
    true,
  );
  assert.equal(
    isDueForFinalScoreCheck({ ...game, status: "final" }),
    false,
  );
  assert.equal(
    isDueForFinalScoreCheck({ ...game, status: "postponed" }, new Date("2026-09-14T00:00:00.000Z")),
    false,
  );
});
