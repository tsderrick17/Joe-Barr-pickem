import test from "node:test";
import assert from "node:assert/strict";
import { gradeAtsPick } from "../src/lib/ats-grading.js";
import { isDueForFinalScoreCheck } from "../src/lib/score-window.js";

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

test("grades an underdog cover and a favorite ATS loss", () => {
  assert.equal(
    gradeAtsPick({ ...game, selectedTeamId: "home", awayScore: 24, homeScore: 23 }),
    "win",
  );
  assert.equal(
    gradeAtsPick({ ...game, selectedTeamId: "away", awayScore: 24, homeScore: 23 }),
    "loss",
  );
});

test("grades a pick-em winner and records a tie as a loss", () => {
  assert.equal(
    gradeAtsPick({ ...game, selectedTeamId: "away", lockedSpread: 0, awayScore: 20, homeScore: 17 }),
    "win",
  );
  assert.equal(
    gradeAtsPick({ ...game, selectedTeamId: "away", lockedSpread: 0, awayScore: 20, homeScore: 20 }),
    "loss",
  );
});

test("does not grade without a usable official line", () => {
  assert.equal(gradeAtsPick({ ...game, selectedTeamId: "away", favoriteTeamId: null }), "pending");
  assert.equal(gradeAtsPick({ ...game, selectedTeamId: "away", lockedSpread: Number.NaN }), "pending");
  assert.equal(gradeAtsPick({ ...game, selectedTeamId: "other" }), "pending");
});

test("begins final-score checks three hours after kickoff", () => {
  const game = { kickoffAt: "2026-09-13T17:00:00.000Z", status: "scheduled" };

  assert.equal(
    isDueForFinalScoreCheck(game, new Date("2026-09-13T19:59:59.000Z")),
    false,
  );
  assert.equal(
    isDueForFinalScoreCheck(game, new Date("2026-09-13T20:00:00.000Z")),
    true,
  );
  assert.equal(
    isDueForFinalScoreCheck({ ...game, status: "final" }),
    false,
  );
  assert.equal(
    isDueForFinalScoreCheck({ ...game, status: "postponed" }, new Date("2026-09-14T00:00:00.000Z")),
    false,
  );
});
