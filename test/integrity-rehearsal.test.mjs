import assert from "node:assert/strict";
import test from "node:test";
import { assessSeasonIntegrity } from "../src/lib/integrity-rehearsal.js";

const period = { id: "week-1", max_picks: 2, status: "complete" };
const finalGame = { id: "game-1", scoring_period_id: "week-1", away_team_id: "away", home_team_id: "home", status: "final" };

test("passes a settled two-pick week with unique Survivor teams", () => {
  const result = assessSeasonIntegrity({
    periods: [period], games: [finalGame], lineGameIds: new Set(["game-1"]),
    picks: [{ player_id: "p1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "away", result: "win" }],
    survivorPicks: [{ survivor_entry_id: "s1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "home", result: "loss" }],
  });
  assert.equal(result.status, "healthy");
  assert.equal(result.checks.every((check) => check.failed === 0), true);
});

test("finds over-limit, invalid, reused, and ungraded records", () => {
  const result = assessSeasonIntegrity({
    periods: [period], games: [finalGame], lineGameIds: new Set(["game-1"]),
    picks: [
      { player_id: "p1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "away", result: "pending" },
      { player_id: "p1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "home", result: "win" },
      { player_id: "p1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "away", result: "win" },
      { player_id: "p2", scoring_period_id: "wrong-week", game_id: "game-1", selected_team_id: "not-a-team", result: "win" },
    ],
    survivorPicks: [
      { survivor_entry_id: "s1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "away", result: "pending" },
      { survivor_entry_id: "s1", scoring_period_id: "week-1", game_id: "game-1", selected_team_id: "away", result: "loss" },
    ],
  });
  assert.equal(result.status, "attention");
  assert.equal(result.checks.find((check) => check.id === "ats-limit")?.failed, 1);
  assert.equal(result.checks.find((check) => check.id === "ats-validity")?.failed, 1);
  assert.equal(result.checks.find((check) => check.id === "ats-finals")?.failed, 1);
  assert.equal(result.checks.find((check) => check.id === "survivor-reuse")?.failed, 1);
  assert.equal(result.checks.find((check) => check.id === "survivor-finals")?.failed, 1);
});
