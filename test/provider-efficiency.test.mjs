import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { nextScoreCheckAt } from "../src/lib/score-check-backoff.ts";
import { shouldHoldScorePollingForQuota } from "../src/lib/score-check-backoff.ts";
import { providerRequestCost, summarizeProviderCalendarMonth, summarizeProviderEfficiency } from "../src/lib/provider-efficiency.js";
import { isEasternPrelockRefreshWindow } from "../src/lib/prelock-refresh-window.ts";
import { shouldRunBowlScoreSync } from "../src/lib/score-worker-cadence.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("regular-season score polling uses a predictable cadence before expanding its cooldown", () => {
  const now = new Date("2026-09-14T00:00:00.000Z");
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((attempt) => nextScoreCheckAt(attempt, now)),
    [
      "2026-09-14T00:10:00.000Z",
      "2026-09-14T00:10:00.000Z",
      "2026-09-14T00:10:00.000Z",
      "2026-09-14T00:10:00.000Z",
      "2026-09-14T00:10:00.000Z",
      "2026-09-14T00:10:00.000Z",
      "2026-09-14T00:20:00.000Z",
      "2026-09-14T00:20:00.000Z",
      "2026-09-14T00:20:00.000Z",
      "2026-09-14T01:00:00.000Z",
      "2026-09-14T02:00:00.000Z",
      "2026-09-14T04:00:00.000Z",
    ],
  );
  assert.equal(nextScoreCheckAt(12, now), "2026-09-14T04:00:00.000Z");
});

test("playoff polling uses the same predictable ladder while the fifty-credit reserve remains", () => {
  const now = new Date("2026-09-14T00:00:00.000Z");
  assert.equal(nextScoreCheckAt(1, now, false), "2026-09-14T00:10:00.000Z");
  assert.equal(nextScoreCheckAt(1, now, true), "2026-09-14T00:10:00.000Z");
  assert.equal(nextScoreCheckAt(9, now, true), "2026-09-14T00:20:00.000Z");
  assert.equal(shouldHoldScorePollingForQuota(49, "2026-09-13T00:00:00.000Z", now), true);
  assert.equal(shouldHoldScorePollingForQuota(50, "2026-09-13T00:00:00.000Z", now), false);
});

test("only the daylight-safe invocation at 7 AM Eastern may refresh pregame odds", () => {
  assert.equal(isEasternPrelockRefreshWindow(new Date("2026-09-14T11:00:00.000Z")), true);
  assert.equal(isEasternPrelockRefreshWindow(new Date("2026-09-14T12:00:00.000Z")), false);
  assert.equal(isEasternPrelockRefreshWindow(new Date("2026-12-14T11:00:00.000Z")), false);
  assert.equal(isEasternPrelockRefreshWindow(new Date("2026-12-14T12:00:00.000Z")), true);
});

test("provider efficiency tracks observed credits, productive checks, and week-over-week direction", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  const result = summarizeProviderEfficiency([
    { job_type: "scores", completed_at: "2026-09-20T20:00:00.000Z", details: { providerChecked: true, requestsLast: "2", finalScoresImported: 2 } },
    { job_type: "scores", completed_at: "2026-09-19T20:00:00.000Z", details: { providerChecked: true, requestsLast: "2", finalScoresImported: 0 } },
    { job_type: "scores", completed_at: "2026-09-10T20:00:00.000Z", details: { providerChecked: true, finalScoresImported: 1 } },
    { job_type: "line_locks", completed_at: "2026-09-20T12:00:00.000Z", details: { dueGames: 4, requestsLast: "1" } },
    { job_type: "odds", completed_at: "2026-09-20T11:00:00.000Z", details: { providerChecked: true, requestsLast: "1" } },
  ], now);
  assert.deepEqual(result, {
    windowDays: 30,
    providerCalls: 5,
    totalCredits: 8,
    scoreCalls: 3,
    scoreCredits: 6,
    finalizedGames: 3,
    productiveScoreCalls: 2,
    productiveRate: 67,
    creditsPerFinal: 2,
    currentSevenDayCreditsPerFinal: 2,
    previousSevenDayCreditsPerFinal: 2,
    trend: "steady",
  });
});

test("a failed provider response still counts a reported charge", () => {
  assert.equal(providerRequestCost({
    job_type: "scores",
    status: "failed",
    details: { providerChecked: true, requestsLast: "2" },
  }), 2);
  assert.equal(providerRequestCost({
    job_type: "scores",
    status: "failed",
    details: { providerChecked: true, requestsLast: "0" },
  }), 0);
});

test("calendar-month tracking exposes five-Sunday planning context separately from rolling efficiency", () => {
  const result = summarizeProviderCalendarMonth([
    { job_type: "scores", completed_at: "2026-11-01T12:00:00.000Z", details: { providerChecked: true, requestsLast: "2" } },
    { job_type: "line_locks", completed_at: "2026-11-02T12:00:00.000Z", details: { dueGames: 3, requestsLast: "1" } },
  ], new Date("2026-11-03T12:00:00.000Z"));
  assert.equal(result.sundaysInMonth, 5);
  assert.equal(result.creditsTracked, 3);
  assert.equal(result.scoreCredits, 2);
  assert.equal(result.lineLockCredits, 1);
});

test("a rejected score-provider call persists per-game backoff before failing", async () => {
  const source = await readFile(path.join(root, "src/lib/sync-final-scores.ts"), "utf8");
  const failureHandler = source.slice(source.lastIndexOf("} catch (error)"));
  assert.match(failureHandler, /if \(!providerResponseAccepted\)/);
  assert.match(failureHandler, /deferUnfinishedScoreChecks\(eligibleGames, backoffByGameId, checkedAt, playoffPeriodIds\)/);
  assert.match(failureHandler, /providerChecked: providerRequestAttempted/);
  assert.match(failureHandler, /requestsLast: failedRequestsLast/);
});

test("one paid score response settles every due completed game it already contains", async () => {
  const source = await readFile(path.join(root, "src/lib/sync-final-scores.ts"), "utf8");
  assert.match(source, /const dueGameByExternalId = new Map\([\s\S]*scoreDueGames\.flatMap/);
  assert.match(source, /const savedGames = scoreDueGames\.filter/);
  assert.match(source, /period\.period_type === "playoff"/);
});

test("the faster NFL worker preserves the bowl sync's 15-minute cadence", () => {
  assert.equal(shouldRunBowlScoreSync(new Date("2026-09-20T20:00:00.000Z")), true);
  assert.equal(shouldRunBowlScoreSync(new Date("2026-09-20T20:05:00.000Z")), false);
  assert.equal(shouldRunBowlScoreSync(new Date("2026-09-20T20:15:00.000Z")), true);
});

test("ten-minute worker remains reproducible and isolated rehearsals strip its live schedule", async () => {
  const [migration, isolation] = await Promise.all([
    readFile(path.join(root, "supabase/migrations/20260921040000_set_score_polling_ten_minutes.sql"), "utf8"),
    readFile(path.join(root, "scripts/prepare-isolated-schema.mjs"), "utf8"),
  ]);
  assert.match(migration, /refresh-final-nfl-scores-every-ten-minutes/);
  assert.match(migration, /'\*\/10 \* \* \* \*'/);
  assert.match(migration, /Final score worker every ten minutes/);
  assert.match(isolation, /PRODUCTION ADAPTIVE SCORE SCHEDULE/);
});

test("only the Commissioner score route explicitly bypasses automatic cooldown", async () => {
  const [adminRoute, cronRoute] = await Promise.all([
    readFile(path.join(root, "src/app/api/admin/sync-scores/route.ts"), "utf8"),
    readFile(path.join(root, "src/app/api/cron/sync-scores/route.ts"), "utf8"),
  ]);
  assert.match(adminRoute, /bypassProviderCooldown: true/);
  assert.doesNotMatch(cronRoute, /bypassProviderCooldown/);
});
