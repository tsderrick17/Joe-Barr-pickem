import test from "node:test";
import assert from "node:assert/strict";
import { trophyRoomOpen, trophyRoomOpensAt } from "../src/lib/trophy-room-access.js";
import { bowlPoolLaunchAt } from "../src/lib/bowl-pool.js";

test("the Trophy Room opens for every player at the moment the Bowl Pool first launches: December 7, 3:00 AM Eastern", () => {
  assert.equal(trophyRoomOpensAt(), bowlPoolLaunchAt(2026));
  assert.equal(trophyRoomOpensAt(), "2026-12-07T08:00:00.000Z");
});

test("before that only the Commissioner can see it; from then on everyone can, for good", () => {
  const opens = Date.parse(trophyRoomOpensAt());
  assert.equal(trophyRoomOpen(opens - 1, false), false);
  assert.equal(trophyRoomOpen(opens - 1, true), true, "the Commissioner can preview");
  assert.equal(trophyRoomOpen(opens, false), true);
  assert.equal(trophyRoomOpen(Date.parse("2027-08-15T12:00:00Z"), false), true, "it does not close between seasons the way the Bowl Pool does");
});
