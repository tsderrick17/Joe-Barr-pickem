import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The real delivery loop (deliverEmailReminder), with the receipt table kept in memory and the mail provider scripted:
// one durable receipt per reminder and player, a sent or suppressed receipt is never sent again, and nothing caps a
// valid day's emails.
const receipts = new Map(); // `${reminder_id}:${player_id}` -> row
let nextId = 1;
const key = (reminderId, playerId) => `${reminderId}:${playerId}`;
const filter = (calls, column) => calls.filter(([name, args]) => name === "eq" && args[0] === column).map(([, args]) => args[1])[0];
const respond = (table, calls) => {
  if (table !== "email_reminder_deliveries") throw new Error(`unexpected table ${table}`);
  const insert = calls.find(([name]) => name === "insert")?.[1][0];
  if (insert) {
    const existing = receipts.get(key(insert.reminder_id, insert.player_id));
    if (existing) return { data: null, error: { code: "23505", message: "duplicate key" } };
    const row = { id: `receipt-${nextId++}`, reminder_id: insert.reminder_id, player_id: insert.player_id, status: "sending", provider_status: null, attempt_count: 1 };
    receipts.set(key(row.reminder_id, row.player_id), row);
    return { data: { ...row }, error: null };
  }
  const update = calls.find(([name]) => name === "update")?.[1][0];
  if (update) {
    const id = filter(calls, "id");
    const row = [...receipts.values()].find((entry) => entry.id === id);
    if (!row) return { data: null, error: null };
    if (filter(calls, "status") && row.status !== filter(calls, "status")) return { data: null, error: null };
    Object.assign(row, update);
    return { data: { ...row }, error: null };
  }
  const row = receipts.get(key(filter(calls, "reminder_id"), filter(calls, "player_id")));
  return { data: row ? { ...row } : null, error: null };
};
globalThis.deliveryFixture = { supabaseAdmin: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.deliveryFixture.supabaseAdmin[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
process.env.BREVO_API_KEY = "fixture-key";
process.env.BREVO_SENDER_EMAIL = "sender@fixture.invalid";
const { deliverEmailReminder } = await import("../src/lib/email-reminders.ts");

const reminder = (id = "reminder-1") => ({ id, category: "pick_due", audience: "all_active", title: "Picks are due", body: "Make your picks.", automation_key: null, recap_snapshot: null });
const people = (count) => Array.from({ length: count }, (_, index) => ({ playerId: `player-${index + 1}`, email: `player${index + 1}@fixture.invalid` }));
let sends;
let providerStatus;
const reset = (status = 201) => {
  receipts.clear(); nextId = 1; sends = []; providerStatus = status;
  globalThis.deliveryFixture.supabaseAdmin = recordingDatabase(respond);
  mock.method(globalThis, "fetch", async (url, init) => { sends.push({ url, to: JSON.parse(init.body).to[0].email }); return { ok: providerStatus < 400, status: providerStatus, json: async () => ({ messageId: `message-${sends.length}`, message: "provider said no" }) }; });
};

test("an empty Pick Due audience is a suppressed no-op: no receipts, no email", async () => {
  reset();
  const result = await deliverEmailReminder(reminder(), []);
  assert.equal(result.suppressed, true);
  assert.match(result.suppressionReason, /No player has an outstanding/);
  assert.equal(result.sent, 0);
  assert.equal(receipts.size, 0);
  assert.equal(sends.length, 0);
  mock.restoreAll();
});

test("each recipient gets one durable receipt and one email", async () => {
  reset();
  const result = await deliverEmailReminder(reminder(), people(3));
  assert.equal(result.sent, 3);
  assert.equal(receipts.size, 3);
  assert.deepEqual(sends.map((send) => send.to), ["player1@fixture.invalid", "player2@fixture.invalid", "player3@fixture.invalid"]);
  assert.ok([...receipts.values()].every((row) => row.status === "sent" && row.provider_status === 201));
  mock.restoreAll();
});

test("running the same reminder again sends nothing: a sent receipt is final", async () => {
  reset();
  await deliverEmailReminder(reminder(), people(3));
  sends.length = 0;
  const again = await deliverEmailReminder(reminder(), people(3));
  assert.equal(again.skipped, 3);
  assert.equal(again.sent, 0);
  assert.equal(sends.length, 0, "nobody is emailed twice");
  assert.equal(receipts.size, 3, "and no second receipt is made");
  mock.restoreAll();
});

test("no global daily cap: a large valid audience is emailed in full", async () => {
  reset();
  const result = await deliverEmailReminder(reminder(), people(60));
  assert.equal(result.sent, 60);
  assert.equal(sends.length, 60);
  mock.restoreAll();
});

test("a receipt stuck in 'sending' is an uncertain delivery: reported, never re-sent", async () => {
  reset();
  receipts.set(key("reminder-1", "player-1"), { id: "receipt-x", reminder_id: "reminder-1", player_id: "player-1", status: "sending", provider_status: null, attempt_count: 1 });
  const result = await deliverEmailReminder(reminder(), people(1));
  assert.equal(result.failed, 1);
  assert.equal(result.retryableFailed, 0);
  assert.match(result.errors[0], /uncertain delivery state/);
  assert.equal(sends.length, 0);
  mock.restoreAll();
});

test("a failed receipt is retried only after a temporary provider failure (425 or 429) and within the attempt limit", async () => {
  reset();
  receipts.set(key("reminder-1", "player-1"), { id: "receipt-a", reminder_id: "reminder-1", player_id: "player-1", status: "failed", provider_status: 429, attempt_count: 1 });
  receipts.set(key("reminder-1", "player-2"), { id: "receipt-b", reminder_id: "reminder-1", player_id: "player-2", status: "failed", provider_status: 400, attempt_count: 1 });
  receipts.set(key("reminder-1", "player-3"), { id: "receipt-c", reminder_id: "reminder-1", player_id: "player-3", status: "failed", provider_status: 429, attempt_count: 3 });
  const result = await deliverEmailReminder(reminder(), people(3));
  assert.deepEqual(sends.map((send) => send.to), ["player1@fixture.invalid"], "only the temporary failure with attempts left is tried again");
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 2);
  assert.equal(receipts.get(key("reminder-1", "player-1")).attempt_count, 2);
  mock.restoreAll();
});

test("a provider that is busy (429) is a retryable failure and the receipt says so; any other rejection is final", async () => {
  reset(429);
  const busy = await deliverEmailReminder(reminder("busy"), people(1));
  assert.equal(busy.failed, 1);
  assert.equal(busy.retryableFailed, 1);
  assert.equal(receipts.get(key("busy", "player-1")).status, "failed");
  assert.equal(receipts.get(key("busy", "player-1")).provider_status, 429);
  providerStatus = 400;
  const rejected = await deliverEmailReminder(reminder("rejected"), people(1));
  assert.equal(rejected.failed, 1);
  assert.equal(rejected.retryableFailed, 0);
  mock.restoreAll();
});
