import assert from "node:assert/strict";
import test from "node:test";
import { calculatePlayoffEligibility } from "../src/lib/playoff-math.js";
import {
  createSeasonClock,
  createSeededRandom,
  easternDay,
  playoffEligibilityOracle,
  replaySeasonStructure,
  sanitizeSeasonReplay,
} from "./support/season-certification.mjs";

test("randomized eligibility agrees with the independent mathematical oracle", () => {
  const random = createSeededRandom(0x20260809);
  for (let scenario = 0; scenario < 5_000; scenario += 1) {
    const playerCount = 2 + Math.floor(random() * 18);
    const players = Array.from({ length: playerCount }, (_, index) => ({ id: `player-${index}` }));
    const periods = [6, 4, 2, 1].map((max_picks, index) => ({
      id: `playoff-${index}`,
      display_order: 19 + index,
      period_type: "playoff",
      status: index === 0 ? "active" : "upcoming",
      max_picks,
    }));
    const today = new Date(Date.UTC(2030, 0, 12, 17 + Math.floor(random() * 10), 30));
    const games = [];
    for (const [periodIndex, period] of periods.entries()) {
      const count = Math.floor(random() * (period.max_picks + 2));
      for (let gameIndex = 0; gameIndex < count; gameIndex += 1) {
        const dayOffset = periodIndex === 0 ? Math.floor(random() * 5) - 2 : 7 * periodIndex;
        games.push({
          id: `${period.id}-game-${gameIndex}`,
          scoring_period_id: period.id,
          kickoff_at: new Date(today.getTime() + dayOffset * 86_400_000).toISOString(),
          status: random() < 0.08 ? "cancelled" : random() < 0.08 ? "postponed" : "scheduled",
        });
      }
    }
    const regularGames = Array.from({ length: 20 }, (_, index) => ({
      id: `regular-${index}`,
      scoring_period_id: "regular",
      kickoff_at: new Date(today.getTime() - (3 + index) * 86_400_000).toISOString(),
      status: "final",
    }));
    games.push(...regularGames);
    const picks = [];
    for (const player of players) {
      for (const game of games) {
        if (random() < 0.28) picks.push({
          player_id: player.id,
          game_id: game.id,
          result: random() < 0.52 ? "win" : random() < 0.5 ? "loss" : "void",
        });
      }
    }
    const input = { players, periods, games, picks, targetPeriodId: periods[0].id, now: today };
    const expected = playoffEligibilityOracle(input);
    const actual = calculatePlayoffEligibility(input);
    assert.equal(actual.leaderWinsAtDayStart, expected.leaderWinsAtDayStart, `scenario ${scenario}`);
    assert.equal(actual.remainingPossibleWins, expected.remainingPossibleWins, `scenario ${scenario}`);
    assert.deepEqual([...actual.eliminatedPlayerIds].sort(), [...expected.eliminatedPlayerIds].sort(), `scenario ${scenario}`);
  }
});

test("season clock crosses midnight and daylight-saving boundaries deterministically", () => {
  const clock = createSeasonClock("2026-03-08T06:59:59.000Z");
  assert.equal(clock.easternDay(), "2026-03-08");
  clock.advance(2 * 60 * 1000);
  assert.equal(clock.iso(), "2026-03-08T07:01:59.000Z");
  assert.equal(clock.easternDay(), "2026-03-08");
  clock.set("2026-11-01T05:59:59.000Z");
  clock.advance(2 * 60 * 1000);
  assert.equal(clock.easternDay(), "2026-11-01");
  clock.set("2026-11-02T04:59:59.000Z");
  assert.equal(easternDay(clock.now()), "2026-11-01");
  clock.advance(2_000);
  assert.equal(clock.easternDay(), "2026-11-02");
});

test("sanitized structural replay removes personal data, retries safely, and pins gameweeks", () => {
  const raw = [
    { type: "scheduled", externalGameId: "game-1", gameweek: 4, kickoffAt: "2026-10-04T17:00:00Z", awayTeam: "BUF", homeTeam: "NE", playerEmail: "private@example.com", picks: [{ player: "secret" }] },
    { type: "scheduled", externalGameId: "game-1", gameweek: 4, kickoffAt: "2026-10-04T17:00:00Z", awayTeam: "BUF", homeTeam: "NE" },
    { type: "rescheduled", externalGameId: "game-1", gameweek: 4, kickoffAt: "2026-10-06T00:15:00Z", lineLockAt: "2026-10-05T23:15:00Z" },
    { type: "final", externalGameId: "game-1", gameweek: 4, awayScore: 20, homeScore: 17 },
    { type: "score_corrected", externalGameId: "game-1", gameweek: 4, awayScore: 21, homeScore: 17 },
  ];
  const clean = sanitizeSeasonReplay(raw);
  assert.equal(JSON.stringify(clean).includes("private@example.com"), false);
  assert.equal(JSON.stringify(clean).includes("picks"), false);
  const replayed = replaySeasonStructure(clean);
  assert.equal(replayed.length, 1);
  assert.deepEqual({
    gameweek: replayed[0].gameweek,
    originalGameweek: replayed[0].originalGameweek,
    kickoffAt: replayed[0].kickoffAt,
    awayScore: replayed[0].awayScore,
  }, { gameweek: 4, originalGameweek: 4, kickoffAt: "2026-10-06T00:15:00Z", awayScore: 21 });
  assert.throws(() => replaySeasonStructure([
    raw[0],
    { type: "rescheduled", externalGameId: "game-1", gameweek: 5, kickoffAt: "2026-10-11T17:00:00Z" },
  ]), /another gameweek/);
});
