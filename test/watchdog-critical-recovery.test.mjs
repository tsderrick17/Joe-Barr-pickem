import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("watchdog recovers only critical work already proven due, then rechecks it", async () => {
  const source = await readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8");
  assert.match(source, /function recoverCriticalWorkerWork/);
  assert.match(source, /health\.criticalWorkers\.problems/);
  assert.match(source, /runWithAutomationLease\("line_locks", lockDueLines\)/);
  assert.match(source, /runWithAutomationLease\("scores", syncFinalScores\)/);
  assert.match(source, /runWithAutomationLease\("reminders", sendDueReminders\)/);
  assert.match(source, /error instanceof AutomationAlreadyRunningError/);
  assert.match(source, /await checkAutomationHealth\(new Date\(\)\)/);
});
