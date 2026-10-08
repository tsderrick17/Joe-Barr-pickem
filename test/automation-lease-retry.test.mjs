import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { mock, test } from "node:test";

// The real lease module, run against a scripted database: claim it (with bounded retries), run the task, release.
const calls = [];
let claimResponses = [];
globalThis.workerFixtureDatabase = {
  rpc(name, args) {
    calls.push({ name, args });
    if (name === "claim_automation_execution_lease") return Promise.resolve(claimResponses.shift() ?? { data: "token-1", error: null });
    return Promise.resolve({ data: null, error: null });
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.workerFixtureDatabase;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";

const { runWithAutomationLease, AutomationAlreadyRunningError } = await import("../src/lib/automation-execution-lease.ts");

const claims = () => calls.filter((call) => call.name === "claim_automation_execution_lease");
const releases = () => calls.filter((call) => call.name === "release_automation_execution_lease");
const heartbeats = () => calls.filter((call) => call.name === "record_automation_worker_heartbeat").map((call) => call.args.target_status);
const reset = (responses = []) => { calls.length = 0; claimResponses = responses; mock.method(console, "error", () => undefined); };
const transient = { data: null, error: new Error("connection reset") };

test("a claimed lease runs the task, reports it, and is released with its token", async () => {
  reset();
  const result = await runWithAutomationLease("line_locks", async () => "done");
  assert.equal(result, "done");
  assert.equal(claims().length, 1);
  assert.deepEqual(claims()[0].args, { target_job_name: "line_locks", lease_seconds: 120 });
  assert.deepEqual(heartbeats(), ["started", "success"]);
  assert.deepEqual(releases().map((call) => call.args), [{ target_job_name: "line_locks", lease_token: "token-1" }]);
  mock.restoreAll();
});

test("a transient claim failure is retried (twice at most) and the task still runs once", async () => {
  reset([transient, transient]);
  let runs = 0;
  await runWithAutomationLease("scores", async () => { runs += 1; });
  assert.equal(claims().length, 3, "the first try plus two retries");
  assert.equal(runs, 1);
  assert.equal(releases().length, 1);
  mock.restoreAll();
});

test("when every claim attempt fails the retries are bounded, the task never runs, and the failure is reported", async () => {
  reset([transient, transient, transient, transient]);
  let runs = 0;
  await assert.rejects(runWithAutomationLease("scores", async () => { runs += 1; }), /could not be acquired/);
  assert.equal(claims().length, 3, "never more than the first try plus two retries");
  assert.equal(runs, 0);
  assert.equal(releases().length, 0, "there is nothing to release");
  assert.deepEqual(heartbeats(), ["started", "failed"]);
  mock.restoreAll();
});

test("a lease someone else holds is refused without running the task or releasing theirs", async () => {
  reset([{ data: null, error: null }]);
  let runs = 0;
  await assert.rejects(runWithAutomationLease("bowl_scores", async () => { runs += 1; }), (error) => error instanceof AutomationAlreadyRunningError && /already running/.test(error.message));
  assert.equal(runs, 0);
  assert.equal(claims().length, 1, "an overlap is an answer, not an error to retry");
  assert.equal(releases().length, 0);
  assert.deepEqual(heartbeats(), ["started", "skipped"]);
  mock.restoreAll();
});

test("a task that fails still releases the lease and the error reaches the caller", async () => {
  reset();
  await assert.rejects(runWithAutomationLease("reminders", async () => { throw new Error("provider down"); }), /provider down/);
  assert.equal(releases().length, 1);
  assert.deepEqual(heartbeats(), ["started", "failed"]);
  mock.restoreAll();
});
