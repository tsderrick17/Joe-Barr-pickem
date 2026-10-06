import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { selectEligibleScoreGames } from "../src/lib/score-polling-plan.ts";

const dueGames = [
  { id: "no-backoff", scoring_period_id: "regular-week" },
  { id: "cooling-down", scoring_period_id: "regular-week" },
  { id: "due-again", scoring_period_id: "playoff-round" },
];
const now = new Date("2026-10-05T18:00:00.000Z");
const playoffPeriodIds = new Set(["playoff-round"]);

test("only due cooldowns block score polling, and playoff mode follows eligible games", () => {
  const result = selectEligibleScoreGames({
    dueGames,
    backoffs: [
      { game_id: "cooling-down", attempts: 2, next_check_at: "2026-10-05T18:10:00.000Z" },
      { game_id: "due-again", attempts: 3, next_check_at: now.toISOString() },
      { game_id: "not-due", attempts: 4, next_check_at: "2026-10-05T17:00:00.000Z" },
    ],
    playoffPeriodIds,
    now,
  });

  assert.deepEqual(result.eligibleGames.map((game) => game.id), ["no-backoff", "due-again"]);
  assert.equal(result.pollingMode, "playoff");
  assert.equal(result.backoffByGameId.get("cooling-down")?.attempts, 2);
});

test("the explicit commissioner bypass ignores automatic cooldowns", () => {
  const result = selectEligibleScoreGames({
    dueGames,
    backoffs: dueGames.map((game) => ({
      game_id: game.id,
      attempts: 5,
      next_check_at: "2026-10-06T18:00:00.000Z",
    })),
    playoffPeriodIds,
    now,
    bypassProviderCooldown: true,
  });

  assert.deepEqual(result.eligibleGames.map((game) => game.id), ["no-backoff", "cooling-down", "due-again"]);
  assert.equal(result.pollingMode, "playoff");
});

test("a delayed playoff game alone does not label a regular-only check as playoff mode", () => {
  const result = selectEligibleScoreGames({
    dueGames: [dueGames[2]],
    backoffs: [{ game_id: "due-again", attempts: 3, next_check_at: "2026-10-05T18:10:00.000Z" }],
    playoffPeriodIds,
    now,
  });

  assert.deepEqual(result.eligibleGames, []);
  assert.equal(result.pollingMode, "regular");
});
