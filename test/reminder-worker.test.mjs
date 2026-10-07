import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach } from "node:test";

// Execute the real worker and delivery-state policy. Only external stages are
// replaced; no database, provider, or email can be reached from this suite.
const at = new Date("2026-10-06T12:00:00.000Z");
const retryAt = "2026-10-06T12:15:00.000Z";
const reminder = {
  id: "fixture-reminder", category: "final_lines", audience: "all_active",
  title: "Fixture lines", body: "Fixture only", source_game_ids: ["fixture-game"],
  source_scoring_period_id: "fixture-period",
};
const emptyResult = { reminders: 0, deferred: 0, suppressed: 0, emailSent: 0, emailFailed: 0 };
const state = {};
class PreparationError extends Error {}
globalThis.reminderWorkerPreparationError = PreparationError;

beforeEach((context) => {
  Object.assign(state, {
    claim: { data: [reminder], error: null },
    readiness: [{ ready: true }], deliveries: [{ sent: 2, failed: 0, retryableFailed: 0 }],
    updateResults: [], calls: [], updates: [],
    rows: new Map([[reminder.id, { status: "sending" }]]),
    controller: new AbortController(), abortOnReadiness: false, abortOnDelivery: false,
  });
  context.mock.timers.enable({ apis: ["Date"], now: at });
  context.mock.method(console, "error", () => {});
  context.mock.method(globalThis, "fetch", async () => { throw new Error("Network is forbidden in worker tests"); });
});

globalThis.reminderWorkerReadiness = async (...args) => {
  state.calls.push(["readiness", ...args]);
  if (state.abortOnReadiness) state.controller.abort(new Error("Fixture lease timeout"));
  const result = state.readiness.shift() ?? { ready: true };
  if (result instanceof Error) throw result;
  return result;
};
globalThis.reminderWorkerDelivery = async (input, _recipients, signal) => {
  state.calls.push(["delivery", input.id]);
  if (signal) assert.equal(signal, state.controller.signal);
  if (state.abortOnDelivery) state.controller.abort(new Error("Fixture lease timeout"));
  assert.deepEqual(input, state.claim.data.find((item) => item.id === input.id));
  const result = state.deliveries.shift();
  if (result instanceof Error || typeof result === "string") throw result;
  assert.ok(result, "Every attempted delivery needs an explicit fixture outcome");
  return result;
};
globalThis.reminderWorkerDatabase = {
  async rpc(name) {
    assert.equal(name, "claim_due_push_reminders");
    state.calls.push(["claim"]);
    return state.claim;
  },
  from(table) {
    assert.equal(table, "push_reminders");
    const filters = {};
    let values;
    const query = {
      update(input) { values = input; return query; },
      eq(column, value) { filters[column] = value; return query; },
      select(columns) { assert.equal(columns, "id"); return query; },
      async maybeSingle() {
        assert.deepEqual(Object.keys(filters).sort(), ["id", "status"]);
        assert.equal(filters.status, "sending", "Never overwrite another claim's completed state");
        state.calls.push(["update", filters.id, values.status]);
        state.updates.push({ id: filters.id, ...values });
        const outcome = state.updateResults.shift();
        const row = state.rows.get(filters.id);
        if (row?.status !== filters.status) return { data: null, error: null };
        // A committed update with a lost response must not be overwritten by
        // the worker's catch path, even though it appears to have failed.
        if (!outcome || outcome.commit) Object.assign(row, values);
        return outcome?.response ?? { data: { id: filters.id }, error: null };
      },
    };
    return query;
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = {
      "@/lib/email-reminders": "export const ReminderPreparationError = globalThis.reminderWorkerPreparationError; export const deliverEmailReminder = globalThis.reminderWorkerDelivery;",
      "@/lib/reminder-readiness": "export const reminderReadiness = globalThis.reminderWorkerReadiness;",
      "@/lib/supabase-admin": "export const supabaseAdmin = globalThis.reminderWorkerDatabase;",
    }[specifier];
    return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : nextResolve(specifier, context);
  },
});
const { sendDueReminders } = await import("../src/lib/reminder-worker.ts");
const saved = () => state.rows.get(reminder.id);

test("an idle reminder claim performs no readiness checks, sends, or writes", async () => {
  for (const data of [null, []]) {
    state.claim = { data, error: null };
    assert.deepEqual(await sendDueReminders(), emptyResult);
  }
  assert.deepEqual(state.calls, [["claim"], ["claim"]]);
});

test("a failed claim stops the worker before any delivery", async () => {
  state.claim = { data: [reminder], error: { message: "fixture claim failure" } };
  await assert.rejects(sendDueReminders(), /could not be claimed/);
  assert.deepEqual(state.calls, [["claim"]]);
});

test("readiness receives the claimed game's and scoring period's immutable scope", async () => {
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailSent: 2 });
  assert.deepEqual(state.calls, [
    ["claim"], ["readiness", "final_lines", ["fixture-game"], "fixture-period"],
    ["delivery", reminder.id], ["update", reminder.id, "sent"],
  ]);
  assert.deepEqual(saved(), { status: "sent", processing_started_at: null, updated_at: at.toISOString(), sent_at: at.toISOString() });
});

test("temporarily unready reminders are deferred without sending or changing their schedule", async () => {
  state.readiness = [{ ready: false, reason: "Results pending" }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, deferred: 1 });
  assert.deepEqual(saved(), { status: "scheduled", processing_started_at: null, updated_at: at.toISOString() });
  assert.equal(state.calls.some(([stage]) => stage === "delivery"), false);
});

test("terminal readiness suppression records its reason without attempting email", async () => {
  state.readiness = [{ ready: false, terminal: true, reason: "No eligible selections" }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, suppressed: 1 });
  assert.equal(saved().status, "suppressed");
  assert.equal(saved().suppression_reason, "No eligible selections");
  assert.equal(state.calls.some(([stage]) => stage === "delivery"), false);
});

test("delivery-stage suppression is not counted as a sent or failed email", async () => {
  state.deliveries = [{ suppressed: true, suppressionReason: "Empty public reveal", sent: 0, failed: 0, retryableFailed: 0 }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, suppressed: 1 });
  assert.equal(saved().status, "suppressed");
  assert.equal(saved().suppression_reason, "Empty public reveal");
});

test("partial recipient delivery waits 15 minutes when any failed recipient is safely retryable", async () => {
  state.deliveries = [{ sent: 2, failed: 2, retryableFailed: 1 }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailSent: 2, emailFailed: 2 });
  assert.deepEqual(saved(), { status: "scheduled", processing_started_at: null, updated_at: at.toISOString(), scheduled_for: retryAt });
});

test("permanent recipient failures retain successful counts without scheduling another send", async () => {
  state.deliveries = [{ sent: 2, failed: 1, retryableFailed: 0 }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailSent: 2, emailFailed: 1 });
  assert.equal(saved().status, "failed");
  assert.equal(saved().scheduled_for, undefined);
});

test("readiness outages requeue without entering delivery", async () => {
  state.readiness = [new Error("fixture readiness outage")];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailFailed: 1 });
  assert.equal(saved().scheduled_for, retryAt);
  assert.equal(state.calls.some(([stage]) => stage === "delivery"), false);
});

test("known preparation failures remain safe to retry after entering the delivery stage", async () => {
  state.deliveries = [new PreparationError("fixture snapshot unavailable")];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailFailed: 1 });
  assert.equal(saved().status, "scheduled");
  assert.equal(saved().scheduled_for, retryAt);
});

for (const failure of [new Error("Provider acceptance unknown"), "Unknown non-Error failure"]) {
  test(`uncertain delivery is failed without automatic retry: ${typeof failure}`, async () => {
    state.deliveries = [failure];
    assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailFailed: 1 });
    assert.deepEqual(saved(), { status: "failed", processing_started_at: null, updated_at: at.toISOString() });
  });
}

test("a lost sent-state response cannot overwrite the committed sent state or resend", async () => {
  state.updateResults = [{ commit: true, response: { data: null, error: { message: "Response lost" } } }];
  await assert.rejects(sendDueReminders(), /state could not be recorded/);
  assert.equal(saved().status, "sent");
  assert.equal(state.calls.filter(([stage]) => stage === "delivery").length, 1);
  assert.deepEqual(state.updates.map((update) => update.status), ["sent", "failed"]);
});

test("a missing state-write acknowledgement after email never schedules a blind retry", async () => {
  state.updateResults = [{ response: { data: null, error: null } }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 1, emailFailed: 1 });
  assert.equal(saved().status, "failed");
  assert.equal(state.calls.filter(([stage]) => stage === "delivery").length, 1);
});

test("unrecordable failure stops the batch before another reminder is sent", async () => {
  const second = { ...reminder, id: "fixture-second" };
  state.claim.data.push(second);
  state.rows.set(second.id, { status: "sending" });
  state.deliveries = [new Error("Uncertain send"), { sent: 1, failed: 0, retryableFailed: 0 }];
  state.updateResults = [{ response: { data: null, error: { message: "Database unavailable" } } }];
  await assert.rejects(sendDueReminders(), /state could not be recorded/);
  assert.deepEqual(state.calls.filter(([stage]) => stage === "delivery"), [["delivery", reminder.id]]);
  assert.equal(state.rows.get(second.id).status, "sending");
});

test("a recorded per-reminder failure permits the next claimed reminder to complete", async () => {
  const second = { ...reminder, id: "fixture-second" };
  state.claim.data.push(second);
  state.rows.set(second.id, { status: "sending" });
  state.deliveries = [new Error("Uncertain send"), { sent: 1, failed: 0, retryableFailed: 0 }];
  assert.deepEqual(await sendDueReminders(), { ...emptyResult, reminders: 2, emailSent: 1, emailFailed: 1 });
  assert.equal(saved().status, "failed");
  assert.equal(state.rows.get(second.id).status, "sent");
});

test("an already-aborted lease safely releases every claimed reminder for a later run", async () => {
  const second = { ...reminder, id: "fixture-second" };
  state.claim.data.push(second);
  state.rows.set(second.id, { status: "sending" });
  state.controller.abort(new Error("Fixture lease timeout"));
  assert.deepEqual(await sendDueReminders(state.controller.signal), { ...emptyResult, deferred: 2 });
  assert.deepEqual(state.calls.filter(([stage]) => stage === "readiness" || stage === "delivery"), []);
  assert.equal(state.rows.get(reminder.id).status, "scheduled");
  assert.equal(state.rows.get(second.id).status, "scheduled");
});

test("a lease expiring during readiness defers that reminder and all remaining claims", async () => {
  const second = { ...reminder, id: "fixture-second" };
  state.claim.data.push(second);
  state.rows.set(second.id, { status: "sending" });
  state.abortOnReadiness = true;
  assert.deepEqual(await sendDueReminders(state.controller.signal), { ...emptyResult, deferred: 2 });
  assert.deepEqual(state.calls.filter(([stage]) => stage === "readiness").map(([stage, category]) => [stage, category]), [["readiness", "final_lines"]]);
  assert.equal(state.rows.get(reminder.id).status, "scheduled");
  assert.equal(state.rows.get(second.id).status, "scheduled");
});

test("a known pre-send cancellation is requeued safely", async () => {
  state.deliveries = [new PreparationError("Lease timed out during reminder preparation")];
  assert.deepEqual(await sendDueReminders(state.controller.signal), { ...emptyResult, reminders: 1, emailFailed: 1 });
  assert.equal(saved().status, "scheduled");
  assert.equal(saved().scheduled_for, retryAt);
});

test("lease cancellation is passed through to an active email send", async () => {
  state.abortOnDelivery = true;
  assert.deepEqual(await sendDueReminders(state.controller.signal), { ...emptyResult, reminders: 1, emailSent: 2 });
  assert.equal(state.calls.some(([stage]) => stage === "delivery"), true);
  assert.equal(state.rows.get(reminder.id).status, "sent");
});

test("cancellation after one completed reminder releases later claimed reminders", async () => {
  const second = { ...reminder, id: "fixture-second" };
  state.claim.data.push(second);
  state.rows.set(second.id, { status: "sending" });
  state.abortOnDelivery = true;
  assert.deepEqual(await sendDueReminders(state.controller.signal), { ...emptyResult, reminders: 1, emailSent: 2, deferred: 1 });
  assert.equal(state.rows.get(reminder.id).status, "sent");
  assert.equal(state.rows.get(second.id).status, "scheduled");
  assert.equal(state.calls.filter(([stage]) => stage === "delivery").length, 1);
});

test("a failed release of an unprocessed claim surfaces instead of abandoning it silently", async () => {
  const second = { ...reminder, id: "fixture-second" };
  state.claim.data.push(second);
  state.rows.set(second.id, { status: "sending" });
  state.controller.abort(new Error("Fixture lease timeout"));
  state.updateResults = [
    { commit: true },
    { response: { data: null, error: { message: "Fixture release failure" } } },
    { response: { data: null, error: { message: "Fixture retry failure" } } },
  ];
  await assert.rejects(sendDueReminders(state.controller.signal), /state could not be recorded/);
  assert.equal(state.rows.get(reminder.id).status, "scheduled");
  assert.equal(state.rows.get(second.id).status, "sending");
});
