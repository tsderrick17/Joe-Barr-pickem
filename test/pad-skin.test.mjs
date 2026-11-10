import assert from "node:assert/strict";
import test from "node:test";
import { padSkinForWeek } from "../src/lib/pad-skin.js";
import { getWeekStartKey, getWeekWindow } from "../src/lib/schedule-time.js";

// A pool week built exactly as the schedule import builds it: Tuesday midnight Eastern to the next Tuesday.
function weekOf(kickoff, periodType = "regular") {
  const window = getWeekWindow(getWeekStartKey(kickoff));
  return { starts_at: window.startsAt, ends_at: window.endsAt, period_type: periodType };
}

// The skin on the week holding a kickoff, looked at when that game kicks off unless another moment is given.
const skinAt = (kickoff, now = kickoff) => padSkinForWeek(weekOf(kickoff), now);

test("the week holding Thanksgiving Day wears the Thanksgiving skin, and the weeks either side wear none", () => {
  assert.equal(skinAt("2026-11-26T17:30:00Z"), "thanksgiving"); // Thursday, November 26, 2026
  assert.equal(skinAt("2026-11-26T17:30:00Z", "2026-11-24T12:00:00Z"), "thanksgiving"); // from the Tuesday the week opens
  assert.equal(skinAt("2026-11-26T17:30:00Z", "2026-12-01T03:00:00Z"), "thanksgiving"); // through Monday night
  assert.equal(skinAt("2026-11-22T18:00:00Z"), null);
  assert.equal(skinAt("2026-12-03T18:00:00Z"), null);
  // The fourth Thursday moves: November 25 in 2027, November 23 in 2028.
  assert.equal(skinAt("2027-11-25T17:30:00Z"), "thanksgiving");
  assert.equal(skinAt("2027-11-28T18:00:00Z"), "thanksgiving");
  assert.equal(skinAt("2028-11-23T17:30:00Z"), "thanksgiving");
  assert.equal(skinAt("2028-11-30T18:00:00Z"), null);
});

test("a holiday from Thursday through Monday dresses the week it falls in", () => {
  assert.equal(skinAt("2026-12-25T18:00:00Z"), "christmas"); // a Friday
  assert.equal(skinAt("2026-12-20T18:00:00Z"), null);
  assert.equal(skinAt("2027-10-31T17:00:00Z"), "halloween"); // a Sunday
  // Christmas 2028 is a Monday, the last day of its week.
  assert.equal(skinAt("2028-12-24T18:00:00Z"), "christmas");
  assert.equal(skinAt("2028-12-28T01:15:00Z"), null);
  // Christmas 2031 is a Thursday, the first game day of its week.
  assert.equal(skinAt("2031-12-25T18:00:00Z"), "christmas");
  assert.equal(skinAt("2031-12-21T18:00:00Z"), null);
});

test("a Tuesday holiday dresses the week before it, and its own week only on the day", () => {
  // Halloween 2028 is a Tuesday: the weekend before it is the Halloween weekend.
  assert.equal(skinAt("2028-10-29T17:00:00Z"), "halloween");
  assert.equal(skinAt("2028-10-29T17:00:00Z", "2028-10-24T12:00:00Z"), "halloween");
  assert.equal(skinAt("2028-11-02T00:15:00Z", "2028-10-31T16:00:00Z"), "halloween"); // Halloween itself
  assert.equal(skinAt("2028-11-02T00:15:00Z", "2028-11-01T04:30:00Z"), null); // 12:30 AM Eastern the next day
  assert.equal(skinAt("2028-11-02T00:15:00Z"), null);
  assert.equal(skinAt("2028-10-22T17:00:00Z"), null);
});

test("a Wednesday holiday dresses the week before it, and its own week through the day", () => {
  // Christmas 2030 is a Wednesday.
  assert.equal(skinAt("2030-12-22T18:00:00Z"), "christmas");
  assert.equal(skinAt("2030-12-29T18:00:00Z", "2030-12-24T15:00:00Z"), "christmas"); // Christmas Eve
  assert.equal(skinAt("2030-12-29T18:00:00Z", "2030-12-26T03:00:00Z"), "christmas"); // 10 PM Eastern on Christmas
  assert.equal(skinAt("2030-12-29T18:00:00Z", "2030-12-26T06:00:00Z"), null); // 1 AM Eastern the next day
  assert.equal(skinAt("2030-12-29T18:00:00Z"), null);
  assert.equal(skinAt("2030-12-15T18:00:00Z"), null);
});

test("a playoff round or a week without dates wears the usual pad", () => {
  const now = "2026-12-25T18:00:00Z";
  assert.equal(padSkinForWeek({ ...weekOf(now), period_type: "playoff" }, now), null);
  assert.equal(padSkinForWeek({ starts_at: null, ends_at: null, period_type: "regular" }, now), null);
  assert.equal(padSkinForWeek({ period_type: "regular" }, now), null);
});
