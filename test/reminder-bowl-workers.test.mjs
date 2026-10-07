import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const updates = [];
let claimed = [];
let databaseCalls = 0;
globalThis.workerFixtureDatabase = {
  rpc(name) {
    databaseCalls += 1;
    if (name === "claim_due_push_reminders") return Promise.resolve({ data: claimed, error: null });
    return Promise.resolve({ data: null, error: null });
  },
  from(table) {
    databaseCalls += 1;
    if (table !== "push_reminders") throw new Error(`unexpected table ${table}`);
    const record = {};
    const chain = {
      update(values) { record.values = values; return chain; },
      eq(column, value) { record[column] = value; return chain; },
      select() { return chain; },
      maybeSingle() { updates.push({ ...record }); return Promise.resolve({ data: { id: record.id }, error: null }); },
    };
    return chain;
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

const outcome = await import("../src/lib/reminder-outcome.ts");
const policy = await import("../src/lib/bowl-line-policy.ts");
const { ExecutionCancelledError, runInExecutionContext } = await import("../src/lib/execution-context.ts");

const AT = new Date("2026-10-04T17:00:00Z");

test("a reminder that is not ready is suppressed for good only when the reason is terminal, else it waits", () => {
  assert.deepEqual(outcome.updateForReadiness({ terminal: true, reason: "week_complete" }, AT), { status: "suppressed", processing_started_at: null, suppression_reason: "week_complete", updated_at: AT.toISOString() });
  assert.deepEqual(outcome.updateForReadiness({ terminal: false }, AT), { status: "scheduled", processing_started_at: null, updated_at: AT.toISOString() });
});

test("after delivery: suppressed, retry in 15 minutes, failed for good, or sent", () => {
  const done = (extra) => outcome.updateForDelivery({ retryableFailed: 0, failed: 0, ...extra }, AT);
  assert.equal(done({}).status, "sent");
  assert.equal(done({}).sent_at, AT.toISOString());
  assert.equal(done({ failed: 2 }).status, "failed");
  // A temporary failure for any address means the whole reminder is retried, and it wins over a permanent one.
  const retry = done({ retryableFailed: 1, failed: 3 });
  assert.equal(retry.status, "scheduled");
  assert.equal(retry.scheduled_for, new Date(AT.getTime() + 15 * 60 * 1000).toISOString());
  assert.deepEqual(done({ suppressed: true, suppressionReason: "no_audience" }).suppression_reason, "no_audience");
  for (const update of [done({}), retry, done({ failed: 1 })]) assert.equal(update.processing_started_at, null);
});

test("an error is retried only if delivery never started or the email could not be prepared", () => {
  assert.equal(outcome.isSafelyRetryable(false, false), true);
  assert.equal(outcome.isSafelyRetryable(true, true), true);
  assert.equal(outcome.isSafelyRetryable(true, false), false, "a delivery that began and then broke is not blindly repeated");
  assert.equal(outcome.updateForError(true, AT).status, "scheduled");
  assert.equal(outcome.updateForError(false, AT).status, "failed");
  assert.equal(outcome.updateForRelease(AT).scheduled_for, undefined, "a reminder never tried is handed back with no delay");
});

test("Bowl line rules: half-point hooks, favorites from ESPN's sign, and the lock stamp", () => {
  assert.equal(policy.lockedSpreadFromOdds(3), 3.5);
  assert.equal(policy.lockedSpreadFromOdds(3.5), 3.5);
  assert.equal(policy.lockedSpreadFromOdds(0), 0, "a pick'em stays a pick'em");
  assert.equal(policy.poolSpreadFromEspn(-3), 3);
  assert.equal(policy.poolSpreadFromEspn(2.25), 2.5);
  assert.equal(policy.poolSpreadFromEspn(-7.1), 7.5);
  assert.equal(policy.favoriteFromEspn(-3, "away", "home"), "home");
  assert.equal(policy.favoriteFromEspn(3, "away", "home"), "away");
  assert.equal(policy.favoriteFromEspn(0, "away", "home"), null);
  const lock = "2026-12-20T13:00:00.000Z";
  assert.equal(policy.lockStampFor(lock, new Date("2026-12-20T12:59:59Z")), null, "before the lock the line is preliminary");
  assert.equal(policy.lockStampFor(lock, new Date("2026-12-20T13:00:00Z")), "2026-12-20T13:00:00.000Z", "at the lock it is fixed");
  assert.equal(policy.lineIsDueToLock(lock, new Date("2026-12-20T13:00:00Z"), false), true);
  assert.equal(policy.lineIsDueToLock(lock, new Date("2026-12-20T13:00:00Z"), true), false, "a locked line is never locked again");
  assert.equal(policy.lineIsDueToLock(lock, new Date("2026-12-20T12:00:00Z"), false), false);
});

test("a stopped reminder run hands every claimed reminder back untouched, and delivers none", async () => {
  const { sendDueReminders } = await import("../src/lib/reminder-worker.ts");
  claimed = [{ id: "r1", category: "weekly_recap", audience: "all_active", title: "t", body: "b" }, { id: "r2", category: "weekly_recap", audience: "all_active", title: "t", body: "b" }];
  updates.length = 0;
  const { result } = runInExecutionContext(-1, () => sendDueReminders()); // a deadline that has already passed
  await assert.rejects(result, (error) => error instanceof ExecutionCancelledError && error.stage === "next reminder");
  assert.deepEqual(updates.map((update) => update.id), ["r1", "r2"], "both go back to the queue");
  for (const update of updates) {
    assert.equal(update.values.status, "scheduled");
    assert.equal(update.values.processing_started_at, null);
    assert.equal(update.status, "sending", "only reminders still claimed by this run are touched");
  }
});

test("no reminder is interrupted once it starts: the checkpoint sits before readiness, not inside delivery", async () => {
  const source = await readFile(new URL("../src/lib/reminder-worker.ts", import.meta.url), "utf8");
  const loop = source.slice(source.indexOf("for (const [index, reminder]"));
  assert.equal((loop.match(/checkpoint\(/g) ?? []).length, 1);
  assert.ok(loop.indexOf("checkpoint(") < loop.indexOf("reminderReadiness("));
  assert.ok(loop.indexOf("checkpoint(") < loop.indexOf("deliverEmailReminder("));
});

test("the Bowl worker stops before touching the database or a provider once past its deadline", async () => {
  process.env.ODDS_API_KEY = "fixture-key";
  const { syncBowlPool } = await import("../src/lib/sync-bowl-pool.ts");
  const realFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls += 1; throw new Error("the provider must not be called"); };
  databaseCalls = 0;
  try {
    const { result } = runInExecutionContext(-1, () => syncBowlPool());
    await assert.rejects(result, (error) => error instanceof ExecutionCancelledError && error.stage === "annual schedule");
    assert.equal(databaseCalls, 0);
    assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("every Bowl stage has a checkpoint and every Bowl provider request carries the cancellable signal", async () => {
  const source = await readFile(new URL("../src/lib/sync-bowl-pool.ts", import.meta.url), "utf8");
  for (const stage of ["annual schedule", "schedule and lines", "scores", "kickoff transitions", "missing-pick losses", "withdrawn drafts", "grade final picks", "champion refresh"]) {
    assert.ok(source.includes(`checkpoint("${stage}")`), stage);
  }
  assert.equal(source.match(/AbortSignal\.timeout\(/g), null, "no request uses a bare timeout that a cancelled run would ignore");
  assert.equal((source.match(/providerSignal\(/g) ?? []).length, 3);
});
