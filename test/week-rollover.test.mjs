import assert from "node:assert/strict";
import test from "node:test";
import {
  nextWeekManualAccessAt,
  normalThursdayChangeoverAt,
  weekRolloverAt,
} from "../src/lib/week-rollover.js";

test("uses Thursday at 3 AM Eastern as the normal default-week handoff", () => {
  assert.equal(
    normalThursdayChangeoverAt("2026-09-08T06:00:00.000Z"),
    "2026-09-10T07:00:00.000Z",
  );
});

test("makes the next week manually available on the next Eastern day", () => {
  assert.equal(
    nextWeekManualAccessAt("2026-09-08T02:30:00.000Z"),
    "2026-09-08T04:00:00.000Z",
  );
});

test("keeps the completed week visible through Thursday and for at least one full day", () => {
  assert.equal(
    weekRolloverAt({
      lastFinalizedAt: "2026-09-07T20:00:00.000Z",
      nextKickoffAt: "2026-09-13T17:00:00.000Z",
    }),
    "2026-09-10T07:00:00.000Z",
  );
});

test("waits a full 24 hours when a late Thursday result misses the normal handoff", () => {
  assert.equal(
    weekRolloverAt({
      lastFinalizedAt: "2026-09-10T12:00:00.000Z",
      nextKickoffAt: "2026-09-17T00:00:00.000Z",
    }),
    "2026-09-11T12:00:00.000Z",
  );
});

test("rolls over at conclusion when the next week starts within a day", () => {
  assert.equal(
    weekRolloverAt({
      lastFinalizedAt: "2026-09-08T06:00:00.000Z",
      nextKickoffAt: "2026-09-09T02:00:00.000Z",
    }),
    "2026-09-08T06:00:00.000Z",
  );
});
