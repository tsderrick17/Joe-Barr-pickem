import assert from "node:assert/strict";
import test from "node:test";
import { gradeSurvivorPick } from "../src/lib/survivor-grading.js";

const game = {
  awayTeamId: "away",
  homeTeamId: "home",
  awayScore: 24,
  homeScore: 20,
};

test("grades a straight-up Survivor winner and loser", () => {
  assert.equal(gradeSurvivorPick({ ...game, selectedTeamId: "away" }), "win");
  assert.equal(gradeSurvivorPick({ ...game, selectedTeamId: "home" }), "loss");
});

test("records a Survivor tie as a loss", () => {
  assert.equal(
    gradeSurvivorPick({ ...game, selectedTeamId: "away", awayScore: 21, homeScore: 21 }),
    "loss",
  );
});
