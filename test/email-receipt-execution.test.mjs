import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach, afterEach } from "node:test";

const state = {};
const reminder = { id: "fixture-reminder", category: "pick_due", audience: "all_active", title: "Fixture", body: "Fixture only" };
const recipient = { playerId: "fixture-player", email: "fixture@example.invalid" };
const receipt = { id: "fixture-receipt", status: "sending", provider_status: null, attempt_count: 1 };
const originalEnvironment = { key: process.env.BREVO_API_KEY, sender: process.env.BREVO_SENDER_EMAIL };
beforeEach((context) => {
  Object.assign(state, { steps: [], queries: [], requests: [], responses: [], controller: new AbortController() });
  process.env.BREVO_API_KEY = "fixture-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.invalid";
  context.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    state.requests.push({ ...options, body: JSON.parse(options.body) });
    assert.ok(state.responses.length, "Unexpected provider call");
    const response = state.responses.shift();
    if (typeof response === "function") return response(options);
    if (response instanceof Error) throw response;
    return response;
  });
});
afterEach(() => {
  assert.deepEqual(state.steps, [], "Every planned database stage must execute");
  assert.deepEqual(state.responses, [], "Every planned provider stage must execute");
  for (const [name, value] of [["BREVO_API_KEY", originalEnvironment.key], ["BREVO_SENDER_EMAIL", originalEnvironment.sender]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

globalThis.receiptTestDatabase = {
  from(table) {
    assert.equal(table, "email_reminder_deliveries");
    const call = { operation: "select", filters: {}, values: null };
    const execute = () => {
      state.queries.push(call);
      const step = state.steps.shift();
      assert.ok(step, "Unexpected database operation");
      assert.equal(call.operation, step.operation);
      if (step.filters) assert.deepEqual(call.filters, step.filters);
      return { data: step.data ?? null, error: step.error ?? null };
    };
    const query = {
      insert(values) { call.operation = "insert"; call.values = values; return query; },
      update(values) { call.operation = "update"; call.values = values; return query; },
      select() { return query; },
      eq(column, value) { call.filters[column] = value; return query; },
      async maybeSingle() { return execute(); },
      then(resolve, reject) { return Promise.resolve().then(execute).then(resolve, reject); },
    };
    return query;
  },
};
const forbiddenServices = (names) => names.map((name) => `export function ${name}(){ throw new Error('Unexpected ${name}'); }`).join("\n");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = {
      "@/lib/supabase-admin": "export const supabaseAdmin = globalThis.receiptTestDatabase;",
      "@/lib/reminder-audience": forbiddenServices(["eligiblePlayerIds"]),
      "@/lib/email-artwork": forbiddenServices(["renderEmailArtwork"]),
      "@/lib/weekly-recap": forbiddenServices(["ensureEarlyLockSnapshot", "ensureFeaturedWindowRevealSnapshot", "ensureFreshSlateSnapshot", "ensureGameDaySlateSnapshot", "ensurePlayoffDayRecapSnapshot", "ensurePlayoffPublicRevealSnapshot", "ensureSundayRevealSnapshot", "ensureWeeklyRecapSnapshot"]),
      "@/lib/bowl-pool-recap": forbiddenServices(["ensureBowlDailyRecapSnapshot", "ensureBowlLineLockSnapshot"]),
    }[specifier];
    return source ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true } : nextResolve(specifier, context);
  },
});
const { deliverEmailReminder, ReminderPreparationError } = await import("../src/lib/email-reminders.ts");
const deliver = () => deliverEmailReminder({ ...reminder }, [recipient]);
const deliverWithSignal = () => deliverEmailReminder({ ...reminder }, [recipient], state.controller.signal);
function existing(values) {
  state.steps.push(
    { operation: "insert", error: { code: "23505" } },
    { operation: "select", filters: { reminder_id: reminder.id, player_id: recipient.playerId }, data: { ...receipt, ...values } },
  );
}
function insertAndUpdate(error = null) {
  state.steps.push({ operation: "insert", data: receipt }, { operation: "update", filters: { id: receipt.id }, error });
}

test("successful send first creates a durable recipient receipt and records provider acceptance", async () => {
  insertAndUpdate();
  state.responses = [Response.json({ messageId: "fixture-message" }, { status: 201 })];
  const result = await deliver();
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(state.queries[0].values, { reminder_id: reminder.id, player_id: recipient.playerId, email_address: recipient.email });
  assert.equal(state.queries[1].values.status, "sent");
  assert.equal(state.queries[1].values.provider_message_id, "fixture-message");
  assert.deepEqual(state.requests[0].body.sender, { name: "PickemJB", email: "sender@example.invalid" });
  assert.deepEqual(state.requests[0].body.to, [{ email: recipient.email }]);
  assert.ok(state.requests[0].signal instanceof AbortSignal);
});

for (const status of ["sent", "suppressed"]) {
  test(`an existing ${status} receipt prevents a duplicate provider call`, async () => {
    existing({ status });
    const result = await deliver();
    assert.equal(result.skipped, 1);
    assert.equal(result.sent, 0);
    assert.deepEqual(state.requests, []);
  });
}

test("an existing sending receipt remains uncertain and is never retried", async () => {
  existing({ status: "sending" });
  const result = await deliver();
  assert.equal(result.failed, 1);
  assert.equal(result.retryableFailed, 0);
  assert.deepEqual(state.requests, []);
});

for (const providerStatus of [425, 429]) {
  test(`provider ${providerStatus} is safely retried through a guarded receipt transition`, async () => {
    existing({ status: "failed", provider_status: providerStatus });
    state.steps.push(
      { operation: "update", filters: { id: receipt.id, status: "failed" }, data: { ...receipt, attempt_count: 2 } },
      { operation: "update", filters: { id: receipt.id } },
    );
    state.responses = [Response.json({ messageId: "fixture-retry" }, { status: 201 })];
    assert.equal((await deliver()).sent, 1);
    assert.equal(state.queries[2].values.attempt_count, 2);
    assert.equal(state.queries[2].values.status, "sending");
    assert.equal(state.requests.length, 1);
  });
}

test("permanent, unknown, and exhausted receipt failures never retry", async () => {
  for (const values of [
    { provider_status: 400 }, { provider_status: 500 }, { provider_status: null },
    { provider_status: 429, attempt_count: 3 }, { provider_status: 425, attempt_count: 3 },
  ]) {
    existing({ status: "failed", ...values });
    const result = await deliver();
    assert.equal(result.failed, 1);
    assert.equal(result.retryableFailed, 0);
  }
  assert.deepEqual(state.requests, []);
});

test("new provider failures retry only explicit 425/429 responses, never server errors or timeouts", async () => {
  for (const status of [425, 429, 400, 500, null]) {
    insertAndUpdate();
    state.responses.push(status === null ? new Error("Fixture timeout") : Response.json({ message: "Fixture rejection" }, { status }));
    const result = await deliver();
    assert.equal(result.failed, 1);
    assert.equal(result.retryableFailed, Number(status === 425 || status === 429));
    assert.equal(state.queries.at(-1).values.status, "failed");
    assert.equal(state.queries.at(-1).values.provider_status, status);
  }
});

test("receipt creation failure stops before contacting the provider", async () => {
  state.steps = [{ operation: "insert", error: { message: "Fixture database outage" } }];
  await assert.rejects(deliver(), ReminderPreparationError);
  assert.deepEqual(state.requests, []);
});

test("losing the guarded retry claim stops before contacting the provider", async () => {
  existing({ status: "failed", provider_status: 429 });
  state.steps.push({ operation: "update", filters: { id: receipt.id, status: "failed" }, data: null });
  await assert.rejects(deliver(), ReminderPreparationError);
  assert.deepEqual(state.requests, []);
});

test("accepted email with a failed receipt write is uncertain, not safe preparation failure", async () => {
  insertAndUpdate({ message: "Fixture lost receipt" });
  state.responses = [Response.json({ messageId: "fixture-accepted" }, { status: 201 })];
  await assert.rejects(deliver(), (error) => !(error instanceof ReminderPreparationError) && /accepted an email/.test(error.message));
  assert.equal(state.requests.length, 1);
  assert.equal(state.queries.length, 2, "No second write may relabel acceptance as a retryable failure");
});

test("a failed failure-receipt write is also uncertain even for provider throttling", async () => {
  insertAndUpdate({ message: "Fixture receipt outage" });
  state.responses = [Response.json({ message: "Throttle" }, { status: 429 })];
  await assert.rejects(deliver(), (error) => !(error instanceof ReminderPreparationError) && /failure receipt/.test(error.message));
  assert.equal(state.requests.length, 1);
});

test("lease cancellation aborts the provider request and records a non-retryable outcome", async () => {
  insertAndUpdate();
  state.responses = [async (options) => {
    assert.equal(options.signal.aborted, false);
    state.controller.abort(new Error("Fixture execution deadline"));
    assert.equal(options.signal.aborted, true);
    throw new DOMException("The operation was aborted", "AbortError");
  }];
  const result = await deliverWithSignal();
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.retryableFailed, 0, "Provider acceptance may be uncertain, so a fresh receipt must not be retried");
  assert.equal(state.queries.at(-1).values.status, "failed");
  assert.equal(state.queries.at(-1).values.provider_status, null);
});

test("lease cancellation between recipients leaves prior receipts intact and marks the remainder retryable", async () => {
  insertAndUpdate();
  state.responses = [async () => {
    state.controller.abort(new Error("Fixture execution deadline"));
    return Response.json({ messageId: "fixture-before-deadline" }, { status: 201 });
  }];
  const result = await deliverEmailReminder({ ...reminder }, [recipient, { playerId: "second-player", email: "second@example.invalid" }], state.controller.signal);
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.retryableFailed, 1);
  assert.equal(state.requests.length, 1);
  assert.equal(state.queries.filter((query) => query.operation === "insert").length, 1);
  assert.equal(state.queries.at(-1).values.status, "sent");
});

test("missing sender configuration is recorded without a provider call", async () => {
  delete process.env.BREVO_API_KEY;
  insertAndUpdate();
  const result = await deliver();
  assert.equal(result.failed, 1);
  assert.equal(result.retryableFailed, 0);
  assert.deepEqual(state.requests, []);
});

test("an empty Pick Due audience is suppressed without creating receipts", async () => {
  const result = await deliverEmailReminder({ ...reminder }, []);
  assert.equal(result.suppressed, true);
  assert.equal(result.recipients, 0);
  assert.deepEqual(state.requests, []);
  assert.deepEqual(state.queries, []);
});
