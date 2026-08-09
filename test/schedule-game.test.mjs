import assert from "node:assert/strict";
import test from "node:test";
import { buildScheduleGame } from "../src/lib/schedule-game.js";

test("daily schedule refresh never upserts a game status", () => {
  const game = buildScheduleGame({
    externalGameId: "event-1",
    scoringPeriodId: "week-1",
    awayTeamId: "away-team",
    homeTeamId: "home-team",
    kickoffAt: "2026-09-13T17:00:00.000Z",
    lineLockAt: "2026-09-13T12:00:00.000Z",
    isInternational: false,
  });

  assert.deepEqual(game, {
    external_game_id: "event-1",
    odds_event_id: "event-1",
    scoring_period_id: "week-1",
    away_team_id: "away-team",
    home_team_id: "home-team",
    kickoff_at: "2026-09-13T17:00:00.000Z",
    line_lock_at: "2026-09-13T12:00:00.000Z",
    is_international: false,
  });
  assert.equal("status" in game, false);
});
