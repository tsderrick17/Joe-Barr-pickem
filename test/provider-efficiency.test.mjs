import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { nextScoreCheckAt } from "../src/lib/score-check-backoff.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("score polling expands failed-provider cooldowns to six hours", () => {
  const now = new Date("2026-09-14T00:00:00.000Z");
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((attempt) => nextScoreCheckAt(attempt, now)),
    [
      "2026-09-14T00:15:00.000Z",
      "2026-09-14T00:30:00.000Z",
      "2026-09-14T01:00:00.000Z",
      "2026-09-14T02:00:00.000Z",
      "2026-09-14T06:00:00.000Z",
    ],
  );
});

test("a rejected score-provider call persists per-game backoff before failing", async () => {
  const source = await readFile(path.join(root, "src/lib/sync-final-scores.ts"), "utf8");
  const failureHandler = source.slice(source.lastIndexOf("} catch (error)"));
  assert.match(failureHandler, /if \(!providerResponseAccepted\)/);
  assert.match(failureHandler, /deferUnfinishedScoreChecks\(eligibleGames, backoffByGameId, checkedAt\)/);
});

test("only the Commissioner score route explicitly bypasses automatic cooldown", async () => {
  const [adminRoute, cronRoute] = await Promise.all([
    readFile(path.join(root, "src/app/api/admin/sync-scores/route.ts"), "utf8"),
    readFile(path.join(root, "src/app/api/cron/sync-scores/route.ts"), "utf8"),
  ]);
  assert.match(adminRoute, /bypassProviderCooldown: true/);
  assert.doesNotMatch(cronRoute, /bypassProviderCooldown/);
});
