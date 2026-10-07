import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const state = { responses: [], calls: [], heartbeats: [], timeout: null };
globalThis.leaseTestState = state;
globalThis.leaseTestDatabase = {
  async rpc(name, args) {
    state.calls.push([name, args]);
    const response = state.responses.shift();
    assert.ok(response, `Unexpected ${name} call`);
    return response;
  },
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return {
      url: "data:text/javascript,export const supabaseAdmin = globalThis.leaseTestDatabase;",
      shortCircuit: true,
    };
    if (specifier === "@/lib/critical-worker-heartbeat-recorder") return {
      url: "data:text/javascript,export async function recordAutomationWorkerHeartbeat(...args){ globalThis.leaseTestState.heartbeats.push(args); }",
      shortCircuit: true,
    };
    if (specifier === "@/lib/automation-execution-timeout") return {
      url: "data:text/javascript,export class AutomationExecutionTimeoutError extends Error {} export async function withExecutionTimeout(job, ms, task){ globalThis.leaseTestState.timeout = [job, ms]; return task({ signal: new AbortController().signal, deadlineAt: Date.now() + ms }); }",
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});

const {
  runWithAutomationLease,
  runWithAutomationLeaseContext,
  AutomationAlreadyRunningError,
  AutomationExecutionTimeoutError,
} = await import("../src/lib/automation-execution-lease.ts");

function reset(...responses) {
  state.responses = responses;
  state.calls = [];
  state.heartbeats = [];
  state.timeout = null;
}

const claim = (token) => ({ data: token, error: null });
const released = { data: null, error: null };
const unavailable = { data: null, error: { message: "temporary database failure" } };
const callNames = () => state.calls.map(([name]) => name);

test("a claimed lease wraps the task, records success, and releases its token", async () => {
  reset(claim("lease-1"), released);
  let observedContext;
  const result = await runWithAutomationLeaseContext("line_locks", async (context) => {
    observedContext = context;
    return "locked";
  });

  assert.equal(result, "locked");
  assert.equal(observedContext.signal.aborted, false);
  assert.ok(observedContext.deadlineAt > Date.now());
  assert.deepEqual(state.timeout, ["line_locks", 90_000]);
  assert.deepEqual(callNames(), ["claim_automation_execution_lease", "release_automation_execution_lease"]);
  assert.deepEqual(state.calls[0][1], { target_job_name: "line_locks", lease_seconds: 120 });
  assert.deepEqual(state.calls[1][1], { target_job_name: "line_locks", lease_token: "lease-1" });
  assert.deepEqual(state.heartbeats, [["line_locks", "started"], ["line_locks", "success"]]);
});

test("a duplicate run never enters the task or releases another run's lease", async () => {
  reset(claim(null));
  let ran = false;
  await assert.rejects(
    runWithAutomationLease("scores", async () => { ran = true; }),
    AutomationAlreadyRunningError,
  );
  assert.equal(ran, false);
  assert.deepEqual(callNames(), ["claim_automation_execution_lease"]);
  assert.deepEqual(state.heartbeats, [["scores", "started"], ["scores", "skipped"]]);
});

test("a transient claim failure retries before entering the task", async () => {
  reset(unavailable, claim("lease-2"), released);
  assert.equal(await runWithAutomationLease("scores", async () => "synced"), "synced");
  assert.deepEqual(callNames(), [
    "claim_automation_execution_lease",
    "claim_automation_execution_lease",
    "release_automation_execution_lease",
  ]);
  assert.deepEqual(state.heartbeats, [["scores", "started"], ["scores", "success"]]);
});

test("claim retries stop after the bounded third attempt and never run the task", async () => {
  reset(unavailable, unavailable, unavailable);
  let ran = false;
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(runWithAutomationLease("scores", async () => { ran = true; }),
      /lease could not be acquired/);
  } finally {
    console.error = originalError;
  }
  assert.equal(ran, false);
  assert.deepEqual(callNames(), Array(3).fill("claim_automation_execution_lease"));
  assert.deepEqual(state.heartbeats, [["scores", "started"], ["scores", "failed"]]);
});

test("a failed task records failure and releases its lease", async () => {
  reset(claim("lease-3"), released);
  await assert.rejects(runWithAutomationLease("scores", async () => {
    throw new Error("provider failed");
  }), /provider failed/);
  assert.deepEqual(callNames(), ["claim_automation_execution_lease", "release_automation_execution_lease"]);
  assert.deepEqual(state.heartbeats, [["scores", "started"], ["scores", "failed"]]);
});

test("a timeout retains the lease for expiry instead of releasing it", async () => {
  reset(claim("lease-4"));
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(runWithAutomationLease("line_locks", async () => {
      throw new AutomationExecutionTimeoutError("line_locks");
    }), AutomationExecutionTimeoutError);
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(callNames(), ["claim_automation_execution_lease"]);
  assert.deepEqual(state.heartbeats, [["line_locks", "started"], ["line_locks", "failed"]]);
});

test("release failure gets one bounded retry without rerunning the task", async () => {
  reset(claim("lease-5"), unavailable, released);
  let taskCalls = 0;
  await runWithAutomationLease("scores", async () => { taskCalls += 1; });
  assert.equal(taskCalls, 1);
  assert.deepEqual(callNames(), [
    "claim_automation_execution_lease",
    "release_automation_execution_lease",
    "release_automation_execution_lease",
  ]);
});
