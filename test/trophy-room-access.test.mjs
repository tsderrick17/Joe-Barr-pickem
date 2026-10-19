import test from "node:test";
import assert from "node:assert/strict";
import { TROPHY_ROOM_PLAYER_OPENS_AT, trophyRoomOpen } from "../src/lib/trophy-room-access.js";
import { bowlPoolLaunchAt } from "../src/lib/bowl-pool.js";

test("the Trophy Room is the Commissioner's alone: no player can see it, whatever the date", () => {
  assert.equal(TROPHY_ROOM_PLAYER_OPENS_AT, null, "no opening for players is scheduled");
  for (const now of [Date.parse("2026-10-19T12:00:00Z"), Date.parse("2026-12-08T12:00:00Z"), Date.parse("2030-01-01T00:00:00Z")]) {
    assert.equal(trophyRoomOpen(now, false), false);
    assert.equal(trophyRoomOpen(now, true), true);
  }
});

test("once an opening is scheduled, everyone can see it from that moment, for good", () => {
  const opensAt = bowlPoolLaunchAt(2026);   // the Bowl Pool's launch is the date it was planned for
  const opens = Date.parse(opensAt);
  assert.equal(trophyRoomOpen(opens - 1, false, opensAt), false);
  assert.equal(trophyRoomOpen(opens - 1, true, opensAt), true, "the Commissioner is never locked out");
  assert.equal(trophyRoomOpen(opens, false, opensAt), true);
  assert.equal(trophyRoomOpen(Date.parse("2027-08-15T12:00:00Z"), false, opensAt), true, "it does not close between seasons the way the Bowl Pool does");
});
