import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { nextScoreCheckTime } from "../src/lib/score-polling-tier.js";
import { providerRequestCost, summarizeProviderEfficiency } from "../src/lib/provider-efficiency.js";
import { isEasternPrelockRefreshWindow } from "../src/lib/prelock-refresh-window.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A game kicking off at 18:00 UTC on a five-minute mark: its next check is the next time on the tier's list after the tick the run was called for.
const KICKOFF = Date.parse("2026-09-13T18:00:00.000Z");
const at = (minutesAfterKickoff, seconds = 4) => KICKOFF + minutesAfterKickoff * 60_000 + seconds * 1000;
const minutesAfter = (iso) => (Date.parse(iso) - KICKOFF) / 60_000;

test("regular-season score polling uses a predictable cadence before expanding its cooldown", () => {
  // Each check of the Normal tier sets the timer to the next time on its list, whatever few seconds the run started after its tick.
  assert.deepEqual(
    [175, 180, 185, 190, 195, 200, 205, 210, 220, 230, 250, 270, 290, 350, 470].map((minutes) => minutesAfter(nextScoreCheckTime("normal", KICKOFF, at(minutes)))),
    [180, 185, 190, 195, 200, 205, 210, 220, 230, 250, 270, 290, 350, 470, 710],
  );
});

test("after the last time a game gets no more automatic checks: its timer is set as far out as polling itself ends", () => {
  const tick = KICKOFF + 710 * 60_000;
  assert.equal(nextScoreCheckTime("normal", KICKOFF, at(710)), new Date(tick + 72 * 3_600_000).toISOString(), "72 hours out");
  assert.equal(nextScoreCheckTime("normal", KICKOFF, at(2000)), new Date(KICKOFF + 2000 * 60_000 + 72 * 3_600_000).toISOString());
});

test("a playoff round follows the same list, and a paused game is looked at again in an hour", () => {
  assert.equal(minutesAfter(nextScoreCheckTime("normal", KICKOFF, at(180))), 185);
  assert.equal(minutesAfter(nextScoreCheckTime("paused", KICKOFF, at(180))), 240);
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
    scoreCredits: 6,
    spreadCredits: 2,
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

test("a rejected score-provider call persists per-game backoff before failing", async () => {
  const source = await readFile(path.join(root, "src/lib/sync-final-scores.ts"), "utf8");
  const failureHandler = source.slice(source.lastIndexOf("} catch (error)"));
  // A provider failure backs the games off; a run stopped by its own deadline does not (see the cancellation tests).
  assert.match(failureHandler, /if \(!providerResponseAccepted && !cancelledByDeadline\)/);
  assert.match(failureHandler, /deferUnfinishedScoreChecks\(eligibleGames, backoffByGameId, checkedAt, tier\)/);
  assert.match(failureHandler, /providerChecked: providerRequestAttempted/);
  assert.match(failureHandler, /requestsLast: failedRequestsLast/);
});

test("one paid score response settles every due completed game it already contains", async () => {
  const source = await readFile(path.join(root, "src/lib/sync-final-scores.ts"), "utf8");
  assert.match(source, /const dueGameByExternalId = new Map\([\s\S]*scoreDueGames\.flatMap/);
  assert.match(source, /const savedGames = scoreDueGames\.filter/);
  assert.match(source, /period\.period_type === "playoff"/);
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
