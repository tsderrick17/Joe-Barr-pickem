import assert from "node:assert/strict";
import test from "node:test";
import { bowlManualLineProblem, easternKickoffIso } from "../src/lib/bowl-commissioner-input.js";

// What the Commissioner may type on the Bowl Pool tab: a hand-entered line, and the new date and time of a postponed game.
const GAME = { away_team_id: "away", home_team_id: "home" };

test("a hand-entered line has a favorite from the game, a half-point spread, and a sensible size; no favorite means a pick'em at 0", () => {
  assert.equal(bowlManualLineProblem({ favoriteTeamId: "home", spread: 3.5 }, GAME), null);
  assert.equal(bowlManualLineProblem({ favoriteTeamId: "away", spread: 0.5 }, GAME), null);
  assert.equal(bowlManualLineProblem({ favoriteTeamId: "away", spread: 30.5 }, GAME)?.includes("typing slip"), true, "35 for 3.5 is caught");
  assert.equal(bowlManualLineProblem({ favoriteTeamId: "away", spread: 30 }, GAME)?.includes("typing slip"), false, "the cap itself is allowed to reach the half-point rule");
  assert.equal(bowlManualLineProblem({ favoriteTeamId: null, spread: 0 }, GAME), null);
  assert.match(bowlManualLineProblem({ favoriteTeamId: null, spread: 3.5 }, GAME), /pick'em/);
  assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: 3 }, GAME), /half point/, "a whole number could tie");
  assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: 0 }, GAME), /Enter how many points/);
  assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: -3.5 }, GAME), /Enter how many points/);
  assert.match(bowlManualLineProblem({ favoriteTeamId: "somebody-else", spread: 3.5 }, GAME), /one of the two teams/);
  assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: Number.NaN }, GAME), /as a number/);
});

test("the Reschedule date and time are Eastern, daylight saving included, and only real dates count", () => {
  assert.equal(easternKickoffIso("2026-12-30", "19:30"), "2026-12-31T00:30:00.000Z", "winter: Eastern is five hours behind UTC");
  assert.equal(easternKickoffIso("2026-12-15", "00:00"), "2026-12-15T05:00:00.000Z");
  assert.equal(easternKickoffIso("2026-06-30", "19:30"), "2026-06-30T23:30:00.000Z", "summer: four hours behind");
  for (const [date, time] of [["", "19:30"], ["2026-12-30", ""], [null, "19:30"], ["2026-12-30", undefined], ["12/30/2026", "19:30"], ["2026-12-30", "7:30 PM"], ["2026-02-31", "19:30"], ["2026-13-01", "19:30"], ["2026-12-30", "24:00"], ["2026-12-30", "19:60"]]) {
    assert.equal(easternKickoffIso(date, time), null, `${date} ${time}`);
  }
});
