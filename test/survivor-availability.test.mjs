import assert from "node:assert/strict";
import test from "node:test";
import { isSurvivorTeamUnavailable } from "../src/lib/survivor-availability.js";

test("keeps this week's saved Survivor pick selectable while choosing a replacement", () => {
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "rams",
    usedTeamIds: ["bills", "rams"],
    savedPickTeamId: "rams",
    gameStarted: false,
    entryEliminated: false,
  }), false);
});

test("blocks teams used in prior Survivor weeks", () => {
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "bills",
    usedTeamIds: ["bills", "rams"],
    savedPickTeamId: "rams",
    gameStarted: false,
    entryEliminated: false,
  }), true);
});

test("never permits a started matchup or eliminated entry", () => {
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "rams",
    usedTeamIds: ["rams"],
    savedPickTeamId: "rams",
    gameStarted: true,
    entryEliminated: false,
  }), true);
  assert.equal(isSurvivorTeamUnavailable({
    teamId: "new-team",
    usedTeamIds: [],
    savedPickTeamId: null,
    gameStarted: false,
    entryEliminated: true,
  }), true);
});
