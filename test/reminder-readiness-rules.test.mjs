import assert from "node:assert/strict";
import test from "node:test";
import {
  isFreshSlateReady,
  isGameDaySlateReady,
  isPlayoffDayRecapReady,
  isRecapReady,
  isSundayWindowReady,
} from "../src/lib/reminder-readiness-rules.js";

const active = { id: "week-6" };
const easternDay = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(value));
const easternWeekday = (value) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(value));
const easternHour = (value) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));

test("does not announce a fresh Slate until the active period has a usable schedule", () => {
  assert.equal(isFreshSlateReady({ activePeriod: active, gameCount: 1 }).ready, false);
  assert.equal(isFreshSlateReady({ activePeriod: active, gameCount: 2 }).ready, true);
  assert.equal(isFreshSlateReady({ activePeriod: null, gameCount: 18 }).ready, false);
});

test("withholds final-line mail until every playable game today has an official line", () => {
  const now = new Date("2026-09-13T16:00:00.000Z");
  const games = [{ id: "a", kickoff_at: "2026-09-13T17:00:00.000Z" }, { id: "b", kickoff_at: "2026-09-13T20:00:00.000Z" }];
  assert.equal(isGameDaySlateReady({ activePeriod: active, games, officialLineGameIds: new Set(["a"]), easternDay, now }).ready, false);
  assert.equal(isGameDaySlateReady({ activePeriod: active, games, officialLineGameIds: new Set(["a", "b"]), easternDay, now }).ready, true);
});

test("weekly recaps wait for all grades, but accept a settled postponed or cancelled game", () => {
  const period = { id: "week-6" };
  assert.equal(isRecapReady({ period, games: [{ status: "final" }, { status: "postponed" }], pendingAtsCount: 0, pendingSurvivorCount: 0 }).ready, true);
  assert.equal(isRecapReady({ period, games: [{ status: "final" }], pendingAtsCount: 1, pendingSurvivorCount: 0 }).ready, false);
  assert.equal(isRecapReady({ period, games: [{ status: "live" }], pendingAtsCount: 0, pendingSurvivorCount: 0 }).ready, false);
});

test("playoff-day recaps wait for the latest started day to settle and grade", () => {
  const now = new Date("2026-01-18T23:00:00.000Z");
  const base = { period: active, now, easternDay };
  assert.equal(isPlayoffDayRecapReady({ ...base, games: [{ kickoff_at: "2026-01-18T18:00:00.000Z", status: "live" }], pendingAtsCount: 0 }).ready, false);
  assert.equal(isPlayoffDayRecapReady({ ...base, games: [{ kickoff_at: "2026-01-18T18:00:00.000Z", status: "final" }], pendingAtsCount: 1 }).ready, false);
  assert.equal(isPlayoffDayRecapReady({ ...base, games: [{ kickoff_at: "2026-01-18T18:00:00.000Z", status: "final" }, { kickoff_at: "2026-01-17T21:00:00.000Z", status: "final" }], pendingAtsCount: 0 }).ready, true);
});

test("Sunday reveal mail waits until every game in the selected window has kicked off", () => {
  const now = new Date("2026-09-13T18:00:00.000Z");
  const base = { activePeriod: active, window: "early", now, easternWeekday, easternHour };
  assert.equal(isSundayWindowReady({ ...base, games: [{ kickoff_at: "2026-09-13T17:00:00.000Z", status: "live" }, { kickoff_at: "2026-09-13T19:00:00.000Z", status: "scheduled" }] }).ready, false);
  assert.equal(isSundayWindowReady({ ...base, games: [{ kickoff_at: "2026-09-13T17:00:00.000Z", status: "live" }] }).ready, true);
});
