import assert from "node:assert/strict";
import test from "node:test";
import { gradeAtsPick } from "../src/lib/ats-grading.js";
import { gradeSurvivorPick } from "../src/lib/survivor-grading.js";
import { SCORING_SCENARIOS } from "./helpers/scoring-scenarios.mjs";

// The same scenarios run through the database in test/integration/scoring-scenarios.test.mjs.
const AWAY = "away-team";
const HOME = "home-team";
const team = (side) => (side === "away" ? AWAY : side === "home" ? HOME : null);

for (const scenario of SCORING_SCENARIOS) {
  test(`app grading: ${scenario.name}`, () => {
    const ats = gradeAtsPick({
      selectedTeamId: team(scenario.ats),
      favoriteTeamId: team(scenario.favorite),
      lockedSpread: scenario.spread,
      awayTeamId: AWAY,
      homeTeamId: HOME,
      awayScore: scenario.away,
      homeScore: scenario.home,
    });
    assert.equal(ats, scenario.atsGrade, "ATS");
    const survivor = gradeSurvivorPick({ selectedTeamId: team(scenario.survivor), awayTeamId: AWAY, homeTeamId: HOME, awayScore: scenario.away, homeScore: scenario.home });
    assert.equal(survivor, scenario.survivorGrade, "Survivor");
  });
}

test("the scenario table covers every outcome the rules can produce", () => {
  const ats = new Set(SCORING_SCENARIOS.map((scenario) => scenario.atsGrade));
  const survivor = new Set(SCORING_SCENARIOS.map((scenario) => scenario.survivorGrade));
  assert.deepEqual([...ats].sort(), ["loss", "pending", "win"]);
  assert.deepEqual([...survivor].sort(), ["loss", "win"]);
  assert.ok(SCORING_SCENARIOS.some((scenario) => scenario.away === scenario.home), "a tied game");
  assert.ok(SCORING_SCENARIOS.some((scenario) => scenario.spread === 0), "a pick'em line");
  assert.ok(SCORING_SCENARIOS.some((scenario) => Number.isInteger(scenario.spread) && scenario.spread > 0 && Math.abs(scenario.away - scenario.home) === scenario.spread), "a push");
});
