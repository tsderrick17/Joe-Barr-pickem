import assert from "node:assert/strict";
import test from "node:test";
import { nextScoreWorkAt } from "../src/lib/score-worker-wake.js";

// When the database gate should next wake the score worker for something other than a final.
const now = new Date("2026-11-03T15:00:00.000Z"); // Tuesday 10:00 AM Eastern

test("a completed week waiting for its handoff wakes the worker at the handoff time", () => {
  const rolloverAt = "2026-11-04T08:00:00.000Z"; // Wednesday 3:00 AM Eastern
  assert.equal(nextScoreWorkAt({ now, weekRollover: { action: "waiting", rolloverAt }, activePeriod: { periodType: "regular", finalKickoffAt: "2026-11-03T01:15:00.000Z" } }), rolloverAt);
});

test("the active week's final kickoff wakes the worker for Survivor no-pick eliminations", () => {
  const finalKickoffAt = "2026-11-10T01:15:00.000Z";
  assert.equal(nextScoreWorkAt({ now, weekRollover: { action: "waiting", rolloverAt: null }, activePeriod: { periodType: "regular", finalKickoffAt } }), finalKickoffAt);
});

test("the earliest of several duties wins, and times already passed are ignored", () => {
  const rolloverAt = "2026-11-04T08:00:00.000Z";
  assert.equal(nextScoreWorkAt({ now, weekRollover: { action: "waiting", rolloverAt }, activePeriod: { periodType: "regular", finalKickoffAt: "2026-11-03T20:00:00.000Z" } }), "2026-11-03T20:00:00.000Z");
  assert.equal(nextScoreWorkAt({ now, weekRollover: { action: "completed", rolloverAt: "2026-11-03T14:00:00.000Z" }, activePeriod: { periodType: "regular", finalKickoffAt: "2026-11-03T01:00:00.000Z" } }), null);
});

test("an active playoff round wakes the worker one minute into the next Eastern day, through daylight saving changes", () => {
  const saturdayNight = new Date("2027-01-17T03:30:00.000Z"); // Saturday 10:30 PM Eastern (standard time)
  assert.equal(nextScoreWorkAt({ now: saturdayNight, activePeriod: { periodType: "playoff", finalKickoffAt: "2027-01-16T21:30:00.000Z" } }), "2027-01-17T05:01:00.000Z");
  const daylight = new Date("2026-10-31T20:00:00.000Z"); // Saturday 4:00 PM Eastern (daylight time)
  assert.equal(nextScoreWorkAt({ now: daylight, activePeriod: { periodType: "playoff", finalKickoffAt: null } }), "2026-11-01T04:01:00.000Z");
});

test("with no active week, the next week's start wakes the worker to open it", () => {
  assert.equal(nextScoreWorkAt({ now, activePeriod: null, upcomingStartsAt: ["2026-11-12T05:00:00.000Z", "2026-11-05T05:00:00.000Z", null] }), "2026-11-05T05:00:00.000Z");
});

test("nothing scheduled leaves it to the hourly safety run", () => {
  assert.equal(nextScoreWorkAt({ now }), null);
  assert.equal(nextScoreWorkAt({ now, activePeriod: { periodType: "regular", finalKickoffAt: null } }), null);
});
