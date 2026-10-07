import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

globalThis.workerCancellationDatabase = {
  requests: 0,
  from() { this.requests += 1; throw new Error("reached the database"); },
  rpc() { this.requests += 1; throw new Error("reached the database"); },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.workerCancellationDatabase;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";

const { checkpoint, currentExecutionContext, ExecutionCancelledError, providerSignal, runInExecutionContext } = await import("../src/lib/execution-context.ts");
const { AutomationExecutionTimeoutError, runWithDeadline } = await import("../src/lib/automation-execution-lease.ts");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("outside a lease a checkpoint never stops anything, and a provider signal is only its own timeout", () => {
  assert.equal(currentExecutionContext(), undefined);
  assert.doesNotThrow(() => checkpoint("anything"));
  const signal = providerSignal(60_000);
  assert.equal(signal.aborted, false);
});

test("a cancelled context stops the run at its next checkpoint, naming the stage", async () => {
  const { result, cancel } = runInExecutionContext(60_000, async () => {
    checkpoint("first stage");
    await sleep(20);
    checkpoint("second stage");
    return "finished";
  });
  cancel(new Error("deadline")); // the first stage has already passed its checkpoint; the next one stops the run
  await assert.rejects(result, (error) => error instanceof ExecutionCancelledError && error.stage === "second stage");
});

test("an expired deadline stops the run even if nothing cancelled it, and an unexpired one does not", async () => {
  let clock = 1_000;
  const now = () => clock;
  const { result } = runInExecutionContext(100, async () => {
    checkpoint("before the deadline", now);
    clock += 500;
    checkpoint("after the deadline", now);
  }, now);
  await assert.rejects(result, (error) => error instanceof ExecutionCancelledError && error.stage === "after the deadline");
});

test("a provider request is aborted when its run is cancelled, not only by its own timeout", async () => {
  let observed;
  const { result, cancel } = runInExecutionContext(60_000, async () => {
    observed = providerSignal(60_000);
    await new Promise((resolve) => observed.addEventListener("abort", resolve, { once: true }));
    return observed.aborted;
  });
  cancel(new Error("deadline"));
  assert.equal(await result, true);
});

test("two runs at once keep separate contexts: cancelling one leaves the other running", async () => {
  const stages = [];
  const first = runInExecutionContext(60_000, async () => { await sleep(10); checkpoint("a"); stages.push("a finished"); });
  const second = runInExecutionContext(60_000, async () => { await sleep(10); checkpoint("b"); stages.push("b finished"); });
  first.cancel(new Error("only a"));
  await assert.rejects(first.result, ExecutionCancelledError);
  await second.result;
  assert.deepEqual(stages, ["b finished"]);
});

test("the timeout boundary releases the caller and stops later stages, without an unhandled rejection", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const effects = [];
  try {
    const run = runWithDeadline("scores", 30, async () => {
      checkpoint("stage one");
      effects.push("stage one committed");
      await sleep(80);
      checkpoint("stage two"); // the deadline passed while stage one's work was slow
      effects.push("stage two committed");
    });
    await assert.rejects(run, (error) => error instanceof AutomationExecutionTimeoutError);
    await sleep(120); // let the abandoned run reach its next checkpoint
    assert.deepEqual(effects, ["stage one committed"], "no stage starts after the deadline");
    assert.deepEqual(unhandled, [], "the abandoned run's own rejection is handled");
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("a run that finishes in time is unaffected, and its context is gone afterwards", async () => {
  const result = await runWithDeadline("scores", 1_000, async () => { checkpoint("only stage"); return "done"; });
  assert.equal(result, "done");
  assert.equal(currentExecutionContext(), undefined);
});

test("the score worker stops before touching the database or the provider once its run is past the deadline", async () => {
  process.env.ODDS_API_KEY = "fixture-key";
  const { syncFinalScores } = await import("../src/lib/sync-final-scores.ts");
  let providerCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { providerCalls += 1; throw new Error("the provider must not be called"); };
  globalThis.workerCancellationDatabase.requests = 0;
  try {
    const { result } = runInExecutionContext(-1, () => syncFinalScores()); // a deadline that has already passed
    await assert.rejects(result, (error) => error instanceof ExecutionCancelledError && error.stage === "annual season check");
    assert.equal(globalThis.workerCancellationDatabase.requests, 0, "no stage ran");
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the line-lock worker stops the same way, before its first stage", async () => {
  const { lockDueLines } = await import("../src/lib/lock-due-lines.ts");
  globalThis.workerCancellationDatabase.requests = 0;
  const recordedFailures = [];
  const database = globalThis.workerCancellationDatabase;
  const originalFrom = database.from;
  // The wrapper records a failed run through the database; allow exactly that one write and nothing else.
  database.from = function from(table) {
    this.requests += 1;
    if (table !== "sync_runs") throw new Error(`unexpected read of ${table}`);
    return { insert: (row) => { recordedFailures.push(row); return Promise.resolve({ error: null }); } };
  };
  try {
    const { result } = runInExecutionContext(-1, () => lockDueLines()); // a deadline that has already passed
    await assert.rejects(result, ExecutionCancelledError);
    assert.equal(recordedFailures.length, 1);
    assert.equal(recordedFailures[0].status, "failed");
    assert.equal(database.requests, 1, "only the failure record was written");
  } finally {
    database.from = originalFrom;
  }
});
