import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationExecutionTimeoutError,
  withExecutionTimeout,
} from "../src/lib/automation-execution-timeout.ts";

test("a lease timeout aborts its task and retains the timeout error", async () => {
  let observedSignal;
  let releaseTask;
  const taskFinished = new Promise((resolve) => { releaseTask = resolve; });

  await assert.rejects(
    withExecutionTimeout("scores", 5, async ({ signal, deadlineAt }) => {
      observedSignal = signal;
      assert.ok(Number.isFinite(deadlineAt));
      await taskFinished;
      signal.throwIfAborted();
      return "too late";
    }),
    (error) => error instanceof AutomationExecutionTimeoutError &&
      error.message === "scores exceeded its execution safety timeout.",
  );

  assert.equal(observedSignal.aborted, true);
  assert.ok(observedSignal.reason instanceof AutomationExecutionTimeoutError);
  releaseTask();
});

test("a completed task keeps its signal active after the timer is cleared", async () => {
  let signal;
  const result = await withExecutionTimeout("scores", 30, async (context) => {
    signal = context.signal;
    return "complete";
  });

  assert.equal(result, "complete");
  assert.equal(signal.aborted, false);
});

test("an abort listener completing the task cannot turn a timeout into success", async () => {
  await assert.rejects(
    withExecutionTimeout("scores", 5, ({ signal }) =>
      new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve("too late"), { once: true });
      }),
    ),
    AutomationExecutionTimeoutError,
  );
});
