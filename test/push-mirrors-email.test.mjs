import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

// Phone notifications mirror the emails, run for real: the production delivery code with the email provider scripted and the database an
// in-memory stand-in. A phone is notified for exactly the players whose email went out now, with the email's subject and message.
const fixture = globalThis.mirrorFixture = { sentPush: [], emailStatus: 200, emails: [] };
const tables = { push_subscriptions: [], email_reminder_deliveries: [] };

function from(table) {
  const state = { op: "select", filters: [], row: null };
  const matching = () => tables[table].filter((row) => state.filters.every(([kind, column, value]) => (kind === "eq" ? row[column] === value : value.includes(row[column]))));
  const run = () => {
    if (state.op === "insert") {
      if (table === "email_reminder_deliveries" && tables[table].some((row) => row.reminder_id === state.row.reminder_id && row.player_id === state.row.player_id)) return { data: null, error: { code: "23505" } };
      const row = { id: `${table}-${tables[table].length + 1}`, status: "sending", provider_status: null, attempt_count: 1, ...state.row };
      tables[table].push(row);
      return { data: [row], error: null };
    }
    if (state.op === "update") { const changed = matching(); for (const row of changed) Object.assign(row, state.row); return { data: changed, error: null }; }
    if (state.op === "delete") { const gone = new Set(matching()); tables[table] = tables[table].filter((row) => !gone.has(row)); return { data: null, error: null }; }
    return { data: matching(), error: null };
  };
  const builder = {
    select() { return builder; },
    insert(row) { Object.assign(state, { op: "insert", row }); return builder; },
    update(row) { Object.assign(state, { op: "update", row }); return builder; },
    delete() { state.op = "delete"; return builder; },
    eq(column, value) { state.filters.push(["eq", column, value]); return builder; },
    in(column, value) { state.filters.push(["in", column, value]); return builder; },
    maybeSingle() { const result = run(); return Promise.resolve({ data: result.data?.[0] ?? null, error: result.error }); },
    then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return builder;
}
fixture.database = { from };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = globalThis.mirrorFixture.database;", shortCircuit: true };
    if (specifier === "@/lib/web-push-keys") return { url: "data:text/javascript,export const vapidKeys = async () => ({ publicKey: 'pub', privateKey: 'priv' });", shortCircuit: true };
    if (specifier === "web-push") return { url: "data:text/javascript,export default { sendNotification: async (subscription, body) => { globalThis.mirrorFixture.sentPush.push({ endpoint: subscription.endpoint, message: JSON.parse(body) }); return {}; } };", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

process.env.BREVO_API_KEY = "test-key";
process.env.BREVO_SENDER_EMAIL = "sender@example.com";
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  fixture.emails.push({ to: body.to[0].email, subject: body.subject });
  return new Response(JSON.stringify({ messageId: "m1" }), { status: fixture.emailStatus });
};

const { deliverEmailReminder } = await import("../src/lib/email-reminders.ts");
const { reminderPushMessage, reminderDestinationPath } = await import("../src/lib/reminder-push.js");

const reminder = (overrides = {}) => ({ id: "r1", category: "custom", audience: "all_active", title: "Sunday early games lock soon", body: "You still have picks to make.", ...overrides });
const recipients = [{ playerId: "p1", email: "one@example.com" }, { playerId: "p2", email: "two@example.com" }, { playerId: "p3", email: "three@example.com" }];
const phone = (playerId, n = 1) => ({ player_id: playerId, endpoint: `https://web.push.apple.com/${playerId}-${n}`, p256dh: "k".repeat(87), auth: "a".repeat(22), id: `${playerId}-${n}` });
const reset = () => { fixture.sentPush = []; fixture.emails = []; fixture.emailStatus = 200; tables.email_reminder_deliveries = []; tables.push_subscriptions = [phone("p1"), phone("p1", 2), phone("p3")]; };

test("each phone gets the email's subject and message when the email goes out", async () => {
  reset();
  const result = await deliverEmailReminder(reminder(), recipients);
  assert.equal(result.sent, 3);
  assert.deepEqual(fixture.emails.map((email) => email.subject), Array(3).fill("Sunday early games lock soon"));
  assert.equal(fixture.sentPush.length, 3, "p1 has two phones, p3 one, p2 none");
  for (const { message } of fixture.sentPush) {
    assert.equal(message.title, "Sunday early games lock soon");
    assert.equal(message.body, "You still have picks to make.");
    assert.equal(message.url, "/board");
    assert.equal(message.tag, "reminder-r1");
  }
  assert.deepEqual(fixture.sentPush.map((sent) => sent.endpoint).sort(), ["https://web.push.apple.com/p1-1", "https://web.push.apple.com/p1-2", "https://web.push.apple.com/p3-1"]);
});

test("a player whose email was not part of the send gets no phone notification", async () => {
  reset();
  await deliverEmailReminder(reminder(), [recipients[1], recipients[2]]);
  assert.deepEqual(fixture.sentPush.map((sent) => sent.endpoint), ["https://web.push.apple.com/p3-1"], "p1 was not emailed, so p1's phones stay quiet");
});

test("running the same reminder again never notifies a phone twice", async () => {
  reset();
  await deliverEmailReminder(reminder(), recipients);
  const first = fixture.sentPush.length;
  const again = await deliverEmailReminder(reminder(), recipients);
  assert.equal(again.skipped, 3, "the emails were already sent");
  assert.equal(fixture.sentPush.length, first, "and so were the phone notifications");
});

test("an email that failed sends no phone notification yet; it follows the email when the email finally goes out", async () => {
  reset();
  fixture.emailStatus = 429;
  const failed = await deliverEmailReminder(reminder(), recipients);
  assert.equal(failed.sent, 0);
  assert.equal(fixture.sentPush.length, 0);
  fixture.emailStatus = 200;
  const retried = await deliverEmailReminder(reminder(), recipients);
  assert.equal(retried.sent, 3);
  assert.equal(fixture.sentPush.length, 3);
});

test("a phone service failure never changes the email result", async () => {
  reset();
  const original = tables.push_subscriptions;
  tables.push_subscriptions = null; // the saved-devices read blows up
  const result = await deliverEmailReminder(reminder(), recipients);
  tables.push_subscriptions = original;
  assert.equal(result.sent, 3);
  assert.equal(result.failed, 0);
});

test("the notification carries the email's extra lines and sends the tap to the same page as the email's button", () => {
  assert.deepEqual(reminderPushMessage({ id: "r9", category: "playoff_day_recap", title: "Round 1 recap", body: "Results are in.", extraLines: ["Eliminated from Pick'em today: Sam.", ""] }), {
    title: "Round 1 recap", body: "Results are in.\n\nEliminated from Pick'em today: Sam.", url: "/", tag: "reminder-r9",
  });
  assert.equal(reminderPushMessage({ id: "r", category: "custom", title: "t", body: "b".repeat(5000) }).body.length, 600);
  const destinations = { bowl_line_lock: "/bowl-pool", bowl_daily_recap: "/bowl-pool", bowl_pick_due: "/bowl-pool", weekly_recap: "/", playoff_day_recap: "/", playoff_public_reveal: "/", sunday_early_reveal: "/", sunday_late_reveal: "/", featured_window_reveal: "/", weekly: "/board", final_lines: "/board", sunday_final_lines: "/board", early_lock: "/board", pick_due: "/board" };
  for (const [category, path] of Object.entries(destinations)) assert.equal(reminderDestinationPath(category), path, category);
});
