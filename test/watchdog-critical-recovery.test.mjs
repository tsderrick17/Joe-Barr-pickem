import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";

// The real recovery step with the three workers and the lease scripted: which work the watchdog may restart, in what
// order, and how each outcome is reported.
const ran = [];
let leaseBehavior = {};
class AutomationAlreadyRunningError extends Error {}
globalThis.recoveryFixture = {
  AutomationAlreadyRunningError,
  runWithAutomationLease: async (job, task) => { ran.push(`${job}:${task.name}`); const behavior = leaseBehavior[job]; if (behavior) throw behavior; return task(); },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shim = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
    if (specifier === "@/lib/automation-execution-lease") return shim("export const AutomationAlreadyRunningError = globalThis.recoveryFixture.AutomationAlreadyRunningError; export const runWithAutomationLease = (...args) => globalThis.recoveryFixture.runWithAutomationLease(...args);");
    if (specifier === "@/lib/lock-due-lines") return shim("export async function lockDueLines() {}");
    if (specifier === "@/lib/sync-final-scores") return shim("export async function syncFinalScores() {}");
    if (specifier === "@/lib/reminder-worker") return shim("export async function sendDueReminders() {}");
    return nextResolve(specifier, context);
  },
});
const { recoverCriticalWorkerWork } = await import("../src/lib/critical-worker-recovery.ts");
const health = (...jobs) => ({ criticalWorkers: { problems: jobs.map((jobName) => ({ jobName })) } });
const reset = (behavior = {}) => { ran.length = 0; leaseBehavior = behavior; mock.method(console, "error", () => undefined); };

test("a healthy pool recovers nothing", async () => {
  reset();
  assert.deepEqual(await recoverCriticalWorkerWork(health()), []);
  assert.deepEqual(ran, []);
  mock.restoreAll();
});

test("only a worker the health check flagged is restarted, through its own lease", async () => {
  reset();
  assert.deepEqual(await recoverCriticalWorkerWork(health("scores")), [{ job: "scores", outcome: "recovered" }]);
  assert.deepEqual(ran, ["scores:syncFinalScores"]);
  mock.restoreAll();
});

test("jobs that are not critical game-day work are never restarted, however the health check lists them", async () => {
  reset();
  assert.deepEqual(await recoverCriticalWorkerWork(health("watchdog", "season_bootstrap", "bowl_scores")), []);
  assert.deepEqual(ran, []);
  mock.restoreAll();
});

test("all three are recovered in a fixed order: line locks, then scores, then reminders", async () => {
  reset();
  const result = await recoverCriticalWorkerWork(health("reminders", "scores", "line_locks"));
  assert.deepEqual(result.map((entry) => entry.job), ["line_locks", "scores", "reminders"]);
  assert.deepEqual(ran, ["line_locks:lockDueLines", "scores:syncFinalScores", "reminders:sendDueReminders"]);
  mock.restoreAll();
});

test("a run already in progress is reported as such, and the others still go ahead", async () => {
  reset({ line_locks: new AutomationAlreadyRunningError("running") });
  const result = await recoverCriticalWorkerWork(health("line_locks", "scores"));
  assert.deepEqual(result, [{ job: "line_locks", outcome: "already-running" }, { job: "scores", outcome: "recovered" }]);
  mock.restoreAll();
});

test("a worker that fails is reported failed and does not stop the next one", async () => {
  reset({ scores: new Error("provider down") });
  const result = await recoverCriticalWorkerWork(health("scores", "reminders"));
  assert.deepEqual(result, [{ job: "scores", outcome: "failed" }, { job: "reminders", outcome: "recovered" }]);
  mock.restoreAll();
});

// The recheck after recovery lives in the long watchdog run, which needs the whole operations stack to execute: kept
// as a rule check.
test("rule: the watchdog rechecks health after recovering, so a recovery is never reported as success unproven", async () => {
  const source = await readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8");
  assert.match(source, /recoverCriticalWorkerWork\(/);
  assert.match(source, /await checkAutomationHealth\(new Date\(\)\)/);
});
