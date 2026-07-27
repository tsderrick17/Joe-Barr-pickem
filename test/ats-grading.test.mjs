import test from "node:test";
import assert from "node:assert/strict";
import { gradeAtsPick } from "../src/lib/ats-grading.js";

const game = {
  favoriteTeamId: "away",
  lockedSpread: 3.5,
  awayTeamId: "away",
  homeTeamId: "home",
  awayScore: 24,
  homeScore: 20,
};

test("grades an ATS favorite win and underdog loss", () => {
  assert.equal(gradeAtsPick({ ...game, selectedTeamId: "away" }), "win");
  assert.equal(gradeAtsPick({ ...game, selectedTeamId: "home" }), "loss");
});

test("records ATS pushes as losses", () => {
  assert.equal(
    gradeAtsPick({ ...game, selectedTeamId: "away", awayScore: 24, homeScore: 21, lockedSpread: 3 }),
    "loss",
  );
  assert.equal(
    gradeAtsPick({ ...game, selectedTeamId: "home", awayScore: 24, homeScore: 21, lockedSpread: 3 }),
    "loss",
  );
});

test("does not grade without a usable official line", () => {
  assert.equal(gradeAtsPick({ ...game, selectedTeamId: "away", favoriteTeamId: null }), "pending");
});
