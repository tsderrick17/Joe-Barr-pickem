import assert from "node:assert/strict";
import test from "node:test";
import { padSkinForWeek } from "../src/lib/pad-skin.js";
import { getWeekStartKey, getWeekWindow } from "../src/lib/schedule-time.js";

// A pool week built exactly as the schedule import builds it: Tuesday midnight Eastern to the next Tuesday.
function weekOf(kickoff, periodType = "regular") {
  const window = getWeekWindow(getWeekStartKey(kickoff));
  return { starts_at: window.startsAt, ends_at: window.endsAt, period_type: periodType };
}

test("the week holding Thanksgiving Day wears the Thanksgiving skin, and the weeks either side wear none", () => {
  assert.equal(padSkinForWeek(weekOf("2026-11-26T17:30:00Z")), "thanksgiving"); // Thursday, November 26, 2026
  assert.equal(padSkinForWeek(weekOf("2026-11-22T18:00:00Z")), null);
  assert.equal(padSkinForWeek(weekOf("2026-12-03T18:00:00Z")), null);
  // The fourth Thursday moves: November 25 in 2027, November 23 in 2028.
  assert.equal(padSkinForWeek(weekOf("2027-11-25T17:30:00Z")), "thanksgiving");
  assert.equal(padSkinForWeek(weekOf("2027-11-28T18:00:00Z")), "thanksgiving");
  assert.equal(padSkinForWeek(weekOf("2028-11-23T17:30:00Z")), "thanksgiving");
  assert.equal(padSkinForWeek(weekOf("2028-11-30T18:00:00Z")), null);
});

test("Christmas and Halloween dress the week whose days include them, Tuesday through Monday", () => {
  assert.equal(padSkinForWeek(weekOf("2026-12-25T18:00:00Z")), "christmas"); // a Friday
  assert.equal(padSkinForWeek(weekOf("2026-12-20T18:00:00Z")), null);
  assert.equal(padSkinForWeek(weekOf("2027-10-31T17:00:00Z")), "halloween"); // a Sunday
  // Halloween 2028 is a Tuesday: it opens the week that follows it, not the one before.
  assert.equal(padSkinForWeek(weekOf("2028-11-02T00:15:00Z")), "halloween");
  assert.equal(padSkinForWeek(weekOf("2028-10-29T17:00:00Z")), null);
  // Christmas 2028 is a Monday, the last day of its week.
  assert.equal(padSkinForWeek(weekOf("2028-12-24T18:00:00Z")), "christmas");
  assert.equal(padSkinForWeek(weekOf("2028-12-28T01:15:00Z")), null);
});

test("a playoff round or a week without dates wears the usual pad", () => {
  assert.equal(padSkinForWeek({ ...weekOf("2026-12-25T18:00:00Z"), period_type: "playoff" }), null);
  assert.equal(padSkinForWeek({ starts_at: null, ends_at: null, period_type: "regular" }), null);
  assert.equal(padSkinForWeek({ period_type: "regular" }), null);
});
