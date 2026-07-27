import assert from "node:assert/strict";
import test from "node:test";
import { shouldRevealPick } from "../src/lib/pick-visibility.js";

const kickoffAt = "2026-09-13T17:00:00.000Z";

test("always reveals a player's own pick", () => {
  assert.equal(
    shouldRevealPick(
      {
        viewerPlayerId: "player-1",
        pickPlayerId: "player-1",
        kickoffAt,
      },
      new Date("2026-09-13T16:59:59.999Z"),
    ),
    true,
  );
});

test("keeps other players' picks hidden before kickoff", () => {
  assert.equal(
    shouldRevealPick(
      {
        viewerPlayerId: "player-1",
        pickPlayerId: "player-2",
        kickoffAt,
      },
      new Date("2026-09-13T16:59:59.999Z"),
    ),
    false,
  );
});

test("reveals other players' picks exactly at kickoff", () => {
  assert.equal(
    shouldRevealPick(
      {
        viewerPlayerId: "player-1",
        pickPlayerId: "player-2",
        kickoffAt,
      },
      new Date(kickoffAt),
    ),
    true,
  );
});

test("keeps another player's pick hidden when its game is unavailable", () => {
  assert.equal(
    shouldRevealPick({ viewerPlayerId: "player-1", pickPlayerId: "player-2" }),
    false,
  );
});
