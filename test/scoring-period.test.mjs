import assert from "node:assert/strict";
import test from "node:test";
import {
  selectAvailableScoringPeriods,
  selectDefaultScoringPeriod,
} from "../src/lib/scoring-period.js";

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

test("keeps the upcoming week hidden until its manual-access time", () => {
  const periods = [
    { id: "1", display_order: 1, status: "active" },
    { id: "2", display_order: 2, status: "upcoming" },
  ];

  assert.deepEqual(
    selectAvailableScoringPeriods(periods, {
      now: 99,
      nextWeekAvailableAt: 100,
    }).map((period) => period.id),
    ["1"],
  );
});

test("offers the upcoming week without changing the default week", () => {
  const periods = [
    { id: "0", display_order: 0, status: "complete" },
    { id: "1", display_order: 1, status: "active" },
    { id: "2", display_order: 2, status: "upcoming" },
    { id: "3", display_order: 3, status: "upcoming" },
  ];

  assert.equal(selectDefaultScoringPeriod(periods).id, "1");
  assert.deepEqual(
    selectAvailableScoringPeriods(periods, {
      now: 100,
      nextWeekAvailableAt: 100,
    }).map((period) => period.id),
    ["0", "1", "2"],
  );
});
