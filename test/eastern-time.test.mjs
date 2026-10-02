import assert from "node:assert/strict";
import test from "node:test";
import { easternDateKey, easternDateTimeToUtc, easternHour, easternParts, easternWeekday } from "../src/lib/eastern-time.js";

// Verbatim copies of the helpers that eastern-time.js replaced (as of
// 2026-10-02). They pin the new module to the exact old behavior.
const zone = "America/New_York";
const old = {
  dateKey: (value) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value),
  hour: (value) => Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(new Date(value))),
  weekday: (value) => new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(new Date(value)),
  // schedule-time.js
  scheduleParts(date) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const value = (type) => Number(parts.find((part) => part.type === type)?.value);
    return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), weekday: parts.find((part) => part.type === "weekday")?.value ?? "" };
  },
  // week-rollover.js
  rolloverParts(date) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const value = (type) => Number(parts.find((part) => part.type === type)?.value);
    return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
  },
  // email-plan-schedule.js and weekly-recap-timing.js
  planParts(value) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
    const part = (type) => parts.find((item) => item.type === type)?.value;
    return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")), weekday: part("weekday"), hour: Number(part("hour")), minute: Number(part("minute")) };
  },
  // schedule-time.js (with minutes) and week-rollover.js (hour only)
  toUtc(year, month, day, hour, minute = 0) {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const eastern = old.scheduleParts(utcGuess);
    const offset = Date.UTC(eastern.year, eastern.month - 1, eastern.day, eastern.hour, eastern.minute) - utcGuess.getTime();
    return new Date(utcGuess.getTime() - offset);
  },
  toUtcHourOnly(year, month, day, hour) {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour));
    const eastern = old.rolloverParts(utcGuess);
    return new Date(utcGuess.getTime() - (Date.UTC(eastern.year, eastern.month - 1, eastern.day, eastern.hour) - utcGuess.getTime()));
  },
};

/** Two full years every 113 minutes (an odd step, so every minute-of-hour is covered), plus every minute around each daylight-saving switch. */
function instants() {
  const list = [];
  for (let at = Date.UTC(2026, 0, 1); at < Date.UTC(2028, 0, 1); at += 113 * 60_000) list.push(new Date(at));
  for (const switchAt of [Date.UTC(2026, 2, 8, 7), Date.UTC(2026, 10, 1, 6), Date.UTC(2027, 2, 14, 7), Date.UTC(2027, 10, 7, 6)]) {
    for (let at = switchAt - 4 * 3_600_000; at <= switchAt + 4 * 3_600_000; at += 60_000) list.push(new Date(at));
  }
  // Eastern midnights and the minute either side, all year.
  for (let day = 0; day < 366; day += 1) {
    const midnight = old.toUtc(2026, 1, 1 + day, 0);
    for (const delta of [-60_000, 0, 60_000]) list.push(new Date(midnight.getTime() + delta));
  }
  return list;
}

test("every Eastern part, date key, hour, and weekday matches the old helpers exactly", () => {
  for (const at of instants()) {
    const parts = easternParts(at);
    const iso = at.toISOString();
    assert.equal(easternDateKey(at), old.dateKey(at), iso);
    assert.equal(easternHour(iso), old.hour(iso), iso);
    assert.equal(easternWeekday(iso), old.weekday(iso), iso);
    assert.deepEqual({ year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, weekday: parts.weekdayShort }, old.scheduleParts(at), iso);
    assert.deepEqual({ year: parts.year, month: parts.month, day: parts.day, hour: parts.hour }, old.rolloverParts(at), iso);
    assert.deepEqual({ year: parts.year, month: parts.month, day: parts.day, weekday: parts.weekday, hour: parts.hour, minute: parts.minute }, old.planParts(iso), iso);
  }
});

test("Eastern wall-clock to UTC matches the old helpers, including the skipped and repeated hours", () => {
  for (let day = 0; day < 731; day += 1) {
    const date = new Date(Date.UTC(2026, 0, 1 + day));
    const [year, month, dayOfMonth] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 30]) {
        assert.equal(easternDateTimeToUtc(year, month, dayOfMonth, hour, minute).toISOString(), old.toUtc(year, month, dayOfMonth, hour, minute).toISOString(), `${year}-${month}-${dayOfMonth} ${hour}:${minute}`);
      }
      assert.equal(easternDateTimeToUtc(year, month, dayOfMonth, hour).toISOString(), old.toUtcHourOnly(year, month, dayOfMonth, hour).toISOString(), `${year}-${month}-${dayOfMonth} ${hour}`);
    }
  }
});

test("midnight reads as hour 0, never 24", () => {
  assert.equal(easternParts(new Date("2026-10-04T04:00:00Z")).hour, 0);
  assert.equal(easternDateKey(new Date("2026-10-04T04:00:00Z")), "2026-10-04");
  assert.equal(easternDateKey(new Date("2026-10-04T03:59:00Z")), "2026-10-03");
});
