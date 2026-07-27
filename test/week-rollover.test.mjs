import assert from "node:assert/strict";
import test from "node:test";
import {
  normalThursdayChangeoverAt,
  weekRolloverAt,
} from "../src/lib/week-rollover.js";

test("uses Thursday at 3 AM Eastern as the normal weekly handoff", () => {
  assert.equal(
    normalThursdayChangeoverAt("2026-09-08T06:00:00.000Z"),
    "2026-09-10T07:00:00.000Z",
  );
});

test("keeps the completed week visible for at least one full day", () => {
  assert.equal(
    weekRolloverAt({
      lastFinalizedAt: "2026-09-09T20:00:00.000Z",
      nextKickoffAt: "2026-09-13T17:00:00.000Z",
    }),
    "2026-09-10T20:00:00.000Z",
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
