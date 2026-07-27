import assert from "node:assert/strict";
import test from "node:test";
import { selectDefaultScoringPeriod } from "../src/lib/scoring-period.js";

test("prefers the active scoring period", () => {
  const period = selectDefaultScoringPeriod([
    { id: "1", status: "complete" },
    { id: "2", status: "active" },
    { id: "3", status: "upcoming" },
  ]);

  assert.equal(period.id, "2");
});

test("uses the next upcoming scoring period before the season begins", () => {
  const period = selectDefaultScoringPeriod([
    { id: "1", status: "upcoming" },
    { id: "2", status: "upcoming" },
  ]);

  assert.equal(period.id, "1");
});

test("uses the latest completed scoring period after the season", () => {
  const period = selectDefaultScoringPeriod([
    { id: "1", status: "complete" },
    { id: "2", status: "complete" },
  ]);

  assert.equal(period.id, "2");
});
