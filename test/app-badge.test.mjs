import assert from "node:assert/strict";
import test from "node:test";
import { picksStillToMake } from "../src/lib/picks-to-make-rule.js";
import { badgeRefreshDue } from "../src/lib/app-badge.js";

const week = (overrides = {}) => ({ maxPicks: 2, openGameIds: ["a", "b", "c"], pickedGameIds: [], survivorApplicable: true, survivorActive: true, survivorPicked: false, ...overrides });

test("the icon number is picks left to make: Pick'em picks plus one for Survivor", () => {
  assert.equal(picksStillToMake(week()), 3);
  assert.equal(picksStillToMake(week({ pickedGameIds: ["a"] })), 2);
  assert.equal(picksStillToMake(week({ pickedGameIds: ["a", "b"] })), 1, "Survivor still open");
  assert.equal(picksStillToMake(week({ pickedGameIds: ["a", "b"], survivorPicked: true })), 0);
});

test("a pick on a game that already kicked off still counts toward the week's picks", () => {
  assert.equal(picksStillToMake(week({ pickedGameIds: ["started"], survivorPicked: true })), 1);
});

test("never more picks than there are open games left to pick", () => {
  assert.equal(picksStillToMake(week({ openGameIds: ["a"], survivorPicked: true })), 1);
  assert.equal(picksStillToMake(week({ openGameIds: ["a"], pickedGameIds: ["a"], survivorPicked: true })), 0);
});

test("nothing open means nothing to make; Survivor counts only while it applies and the player is in", () => {
  assert.equal(picksStillToMake(week({ openGameIds: [] })), 0);
  assert.equal(picksStillToMake(week({ survivorApplicable: false })), 2);
  assert.equal(picksStillToMake(week({ survivorActive: false })), 2);
  assert.equal(picksStillToMake(week({ maxPicks: 6, openGameIds: ["a", "b", "c"], pickedGameIds: ["a"], survivorPicked: true })), 2);
});

test("coming back to the app re-reads the number at most once a minute, and again if the clock moved back", () => {
  assert.equal(badgeRefreshDue(0, 59_999), false);
  assert.equal(badgeRefreshDue(0, 60_000), true);
  assert.equal(badgeRefreshDue(100_000, 50_000), true);
});
