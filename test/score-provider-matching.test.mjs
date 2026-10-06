import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  matchProviderFinalScores,
  selectCompletedProviderEvents,
} from "../src/lib/score-provider-matching.ts";

const games = [
  { id: "game-1", odds_event_id: "event-1", away_team_id: "team-a", home_team_id: "team-b", scoring_period_id: "week-1" },
  { id: "game-2", odds_event_id: "event-2", away_team_id: "team-c", home_team_id: "team-d", scoring_period_id: "week-1" },
  { id: "game-3", odds_event_id: null, away_team_id: "team-e", home_team_id: "team-f", scoring_period_id: "week-1" },
];

const teams = [
  { id: "team-a", full_name: "Away A" },
  { id: "team-b", full_name: "Home B" },
  { id: "team-c", full_name: "Away C" },
  { id: "team-d", full_name: "Home D" },
];

test("only completed provider events for due, linked games enter score matching", () => {
  const events = [
    { id: "event-1", completed: true, scores: [{ name: "Home B", score: "17" }, { name: "Away A", score: 24 }] },
    { id: "event-2", completed: true, scores: [{ name: "Away C", score: "21.5" }, { name: "Home D", score: 14 }] },
    { id: "event-3", completed: true, scores: [{ name: "Away A", score: 1 }, { name: "Home B", score: 0 }] },
    { id: "event-2", completed: false, scores: [{ name: "Away C", score: 21 }, { name: "Home D", score: 14 }] },
  ];

  const completed = selectCompletedProviderEvents(games, events);
  assert.deepEqual(completed.map((event) => event.id), ["event-1", "event-2"]);

  const savedGames = games.filter((game) => completed.some((event) => event.id === game.odds_event_id));
  const result = matchProviderFinalScores(savedGames, completed, teams);
  assert.deepEqual(result.finalizedGames, [{ ...games[0], awayScore: 24, homeScore: 17 }]);
  assert.equal(result.unmatchedCompletedGames, 1);
});

test("a completed event with missing or non-integer team scores is not accepted as a final", () => {
  const completed = [{
    id: "event-1",
    completed: true,
    scores: [{ name: "Away A", score: -1 }, { name: "Unknown team", score: 0 }],
  }];
  const result = matchProviderFinalScores([games[0]], completed, teams);
  assert.deepEqual(result.finalizedGames, []);
  assert.equal(result.unmatchedCompletedGames, 1);
});
