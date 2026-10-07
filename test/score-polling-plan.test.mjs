import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { selectEligibleScoreGames } from "../src/lib/score-polling-plan.ts";
import { buildDeferredScoreCheckRows } from "../src/lib/score-check-backoff.ts";

const dueGames = [
  { id: "no-backoff", scoring_period_id: "regular-week" },
  { id: "cooling-down", scoring_period_id: "regular-week" },
  { id: "due-again", scoring_period_id: "playoff-round" },
];
const now = new Date("2026-10-05T18:00:00.000Z");
const playoffPeriodIds = new Set(["playoff-round"]);

test("deferred score checks produce stable per-game retry rows with incremented attempts", () => {
  const rows = buildDeferredScoreCheckRows({
    games: [
      { id: "first", scoring_period_id: "regular-week" },
      { id: "playoff", scoring_period_id: "playoff-round" },
      { id: "new", scoring_period_id: "regular-week" },
    ],
    previousChecks: new Map([
      ["first", { attempts: 2 }],
      ["playoff", { attempts: 8 }],
    ]),
    checkedAt: now.toISOString(),
    playoffPeriodIds,
  });

  assert.deepEqual(rows, [
    { game_id: "first", attempts: 3, last_checked_at: now.toISOString(), next_check_at: "2026-10-05T18:10:00.000Z", updated_at: now.toISOString() },
    { game_id: "playoff", attempts: 9, last_checked_at: now.toISOString(), next_check_at: "2026-10-05T18:20:00.000Z", updated_at: now.toISOString() },
    { game_id: "new", attempts: 1, last_checked_at: now.toISOString(), next_check_at: "2026-10-05T18:10:00.000Z", updated_at: now.toISOString() },
  ]);
});

test("deferred score checks leave empty batches empty", () => {
  assert.deepEqual(buildDeferredScoreCheckRows({
    games: [],
    previousChecks: new Map(),
    checkedAt: now.toISOString(),
    playoffPeriodIds,
  }), []);
});

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
