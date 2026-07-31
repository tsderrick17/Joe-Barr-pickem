import test from "node:test";
import assert from "node:assert/strict";
import { calculatePlayoffEligibility } from "../src/lib/playoff-math.js";

const players = [{ id: "leader" }, { id: "alive" }, { id: "out" }];
const periods = [
  { id: "wild", display_order: 19, period_type: "playoff", status: "active", max_picks: 6 },
  { id: "div", display_order: 20, period_type: "playoff", status: "upcoming", max_picks: 4 },
  { id: "conf", display_order: 21, period_type: "playoff", status: "upcoming", max_picks: 2 },
  { id: "sb", display_order: 22, period_type: "playoff", status: "upcoming", max_picks: 1 },
];

test("keeps the playoff eligibility snapshot stable for the entire game day", () => {
  const result = calculatePlayoffEligibility({
    players,
    periods,
    targetPeriodId: "wild",
    now: new Date("2026-01-11T21:00:00.000Z"), // Sunday afternoon ET
    games: [
      { id: "old", scoring_period_id: "wild", kickoff_at: "2026-01-10T21:30:00.000Z", status: "final" },
      { id: "early", scoring_period_id: "wild", kickoff_at: "2026-01-11T18:00:00.000Z", status: "final" },
      { id: "late", scoring_period_id: "wild", kickoff_at: "2026-01-11T23:30:00.000Z", status: "scheduled" },
    ],
    picks: [
      { player_id: "leader", game_id: "old", result: "win" },
      { player_id: "leader", game_id: "early", result: "win" },
      { player_id: "alive", game_id: "old", result: "win" },
      { player_id: "out", game_id: "old", result: "loss" },
    ],
  });

  assert.equal(result.leaderWinsAtDayStart, 1);
  assert.equal(result.remainingPossibleWins, 9);
  assert.deepEqual([...result.eliminatedPlayerIds], []);
});

test("marks a player out only when they cannot tie the day-start leader", () => {
  const result = calculatePlayoffEligibility({
    players: [{ id: "leader" }, { id: "out" }],
    periods: [{ id: "sb", display_order: 22, period_type: "playoff", status: "active", max_picks: 1 }],
    targetPeriodId: "sb",
    now: new Date("2026-02-09T15:00:00.000Z"),
    games: [
      { id: "past", scoring_period_id: "sb", kickoff_at: "2026-02-08T23:30:00.000Z", status: "final" },
      { id: "past-two", scoring_period_id: "sb", kickoff_at: "2026-02-08T20:00:00.000Z", status: "final" },
      { id: "past-three", scoring_period_id: "sb", kickoff_at: "2026-02-08T17:00:00.000Z", status: "final" },
      { id: "super", scoring_period_id: "sb", kickoff_at: "2026-02-09T23:30:00.000Z", status: "scheduled" },
    ],
    picks: [
      { player_id: "leader", game_id: "past", result: "win" },
      { player_id: "leader", game_id: "past-two", result: "win" },
      { player_id: "leader", game_id: "past-three", result: "win" },
      { player_id: "out", game_id: "past", result: "win" },
    ],
  });

  assert.equal(result.leaderWinsAtDayStart, 3);
  assert.deepEqual([...result.eliminatedPlayerIds], ["out"]);
});

test("uses the season-long win total when deciding whether a playoff player is out", () => {
  const regularGames = Array.from({ length: 8 }, (_, index) => ({
    id: `regular-${index}`,
    scoring_period_id: "week-18",
    kickoff_at: "2026-01-04T18:00:00.000Z",
    status: "final",
  }));
  const result = calculatePlayoffEligibility({
    players: [{ id: "leader" }, { id: "out" }],
    periods: [
      { id: "week-18", display_order: 18, period_type: "regular", status: "complete", max_picks: 2 },
      { id: "wild", display_order: 19, period_type: "playoff", status: "active", max_picks: 6 },
      { id: "div", display_order: 20, period_type: "playoff", status: "upcoming", max_picks: 4 },
      { id: "conf", display_order: 21, period_type: "playoff", status: "upcoming", max_picks: 2 },
      { id: "sb", display_order: 22, period_type: "playoff", status: "upcoming", max_picks: 1 },
    ],
    targetPeriodId: "wild",
    now: new Date("2026-01-10T15:00:00.000Z"),
    games: regularGames,
    picks: regularGames.map((game) => ({ player_id: "leader", game_id: game.id, result: "win" })),
  });

  assert.equal(result.leaderWinsAtDayStart, 8);
  assert.equal(result.remainingPossibleWins, 7);
  assert.deepEqual([...result.eliminatedPlayerIds], ["out"]);
});
