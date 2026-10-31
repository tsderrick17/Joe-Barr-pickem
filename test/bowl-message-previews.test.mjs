import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { insertedRow, recordingDatabase, wrote } from "./helpers/recording-database.mjs";

// The Commissioner's Email center for the two one-time Bowl Pool messages (the Dec 7 opening announcement and the 24-hour last call), run through
// the real routes with the database scripted: the preview shows the words the sweep would queue, from the real first game; the test send goes only to the
// Commissioner; and their wording can be looked at but never saved or reset.
const SEASON = { id: "bowl-26", season_year: 2026, championship_game_id: "title" };
const GAMES = [
  { id: "postponed-early", bowl_name: "Frisco", kickoff_at: "2026-12-10T22:30:00Z", status: "postponed" },
  { id: "first", bowl_name: "Salute to Veterans", kickoff_at: "2026-12-15T22:30:00Z", status: "scheduled" },
  { id: "second", bowl_name: "Cure", kickoff_at: "2026-12-16T22:30:00Z", status: "scheduled" },
  { id: "title", bowl_name: "National Championship", kickoff_at: "2027-01-26T00:30:00Z", status: "scheduled" },
];
const COMMISSIONER = { notification_email: "commissioner@example.com", email_notifications_enabled: true };
let season, games, commissioner, selectionWording, database;
const respond = (table, calls) => {
  const one = calls.some(([name]) => name === "maybeSingle" || name === "single");
  if (table === "bowl_pool_seasons") return { data: season, error: null };
  if (table === "bowl_pool_games") return { data: games, error: null };
  if (table === "players") return { data: commissioner, error: null };
  if (table === "reminder_templates") return { data: one ? selectionWording : [], error: null };
  if (table === "push_reminders") return { data: calls.some(([name]) => name === "insert") ? { id: "test-1", ...insertedRow(calls) } : null, error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlPreviewFixture = { database: null, delivered: [] };
const realEmailReminders = new URL("../src/lib/email-reminders.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/require-commissioner") return { url: "data:text/javascript,export const commissionerAccess = async () => ({ ok: true, player: { id: 'commissioner-1' } });", shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlPreviewFixture.database[name](...args) });", shortCircuit: true };
    // The real email words and layout, with the one function that would reach Brevo replaced by a recorder.
    if (specifier === "@/lib/email-reminders") return { url: `data:text/javascript,export * from ${JSON.stringify(realEmailReminders)}; export const deliverEmailTest = async (...args) => { globalThis.bowlPreviewFixture.delivered.push(args); return { recipients: 1, sent: 1, failed: 0, errors: [] }; };`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { NextRequest } = await import("next/server.js");
const { POST: preview } = await import("../src/app/api/admin/reminders/preview/route.ts");
const { POST: sendTest } = await import("../src/app/api/admin/reminders/test/route.ts");
const { PUT: saveWording, DELETE: resetWording } = await import("../src/app/api/admin/reminder-templates/route.ts");
const { bowlLastCallMessage, bowlOpeningMessage } = await import("../src/lib/bowl-opening-announcement.js");
const { reminderTemplate } = await import("../src/lib/reminder-templates.ts");

const start = (over = {}) => {
  season = "season" in over ? over.season : SEASON; games = over.games ?? GAMES; commissioner = over.commissioner ?? COMMISSIONER; selectionWording = over.selectionWording ?? null;
  database = recordingDatabase(respond); bowlPreviewFixture.database = database; bowlPreviewFixture.delivered = [];
};
const json = (path, method, body) => new NextRequest(`http://localhost${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const call = async (run) => { const response = await run(); return { status: response.status, body: await response.json() }; };
const previewOf = (templateId) => call(() => preview(json("/api/admin/reminders/preview", "POST", { templateId, title: "ignored", message: "ignored" })));
const sent = (template) => call(() => sendTest(json("/api/admin/reminders/test", "POST", template ? { template } : {})));
const sentWithBody = (body) => call(() => sendTest(new NextRequest("http://localhost/api/admin/reminders/test", { method: "POST", body })));
const inserted = () => database.queries.filter((query) => query.table === "push_reminders").map((query) => insertedRow(query.calls)).filter(Boolean);
const expectedOpening = () => bowlOpeningMessage({ seasonYear: 2026, firstGame: GAMES[1], finalGameKickoffAt: GAMES[3].kickoff_at });
const expectedLastCall = () => bowlLastCallMessage({ firstGame: GAMES[1] });
const decoded = (html) => html.replaceAll("&#39;", "'").replaceAll("&#x27;", "'").replaceAll("&amp;", "&");

test("the opening announcement preview shows the real words: first scheduled game, National Championship date, the subject and the phone message", async () => {
  start();
  const { status, body } = await previewOf("bowl_pool_open");
  const expected = expectedOpening();
  assert.equal(status, 200);
  assert.equal(body.readOnly, true);
  assert.equal(body.subject, "The Bowl Pool is open: claim your seat");
  assert.deepEqual(body.phone, { title: "The Bowl Pool is open", body: "Claim your seat and pick every bowl and playoff game against the spread. First game: Tue, Dec 15." });
  assert.deepEqual(body.images, []);
  const html = decoded(body.html);
  assert.ok(html.includes(expected.snapshot.intro), "the email's introduction");
  assert.ok(html.includes("National Championship on Jan 25"), "the real finish date");
  for (const step of expected.snapshot.steps) assert.ok(html.includes(step), step);
  assert.match(html, /<a href="https:\/\/[^"]*\/bowl-pool"[^>]*>Claim your seat<\/a>/);
  assert.ok(!html.includes("Frisco"), "a postponed game is not the first game");
  assert.ok(!wrote(database.queries.flatMap((query) => query.calls)), "a preview writes nothing");
});

test("the last call preview shows the first game's real kickoff, and ignores the wording a Commissioner typed", async () => {
  start();
  const { status, body } = await previewOf("bowl_pool_last_call");
  const expected = expectedLastCall();
  assert.equal(status, 200);
  assert.equal(body.subject, "Last call: claim your Bowl Pool seat");
  assert.deepEqual(body.phone, { title: expected.title, body: expected.body });
  assert.equal(body.phone.body, "The first game kicks off Tue, Dec 15 at 5:30 PM ET, and entry closes then. Claim your seat now.");
  assert.ok(decoded(body.html).includes(expected.snapshot.intro));
  assert.ok(!body.html.includes("ignored"), "the typed subject and message are not used");
});

test("with no Bowl season or no scheduled game there is nothing to word, and it says so in plain words without writing anything", async () => {
  for (const [name, over] of [["no season", { season: null }], ["no scheduled game", { games: GAMES.map((game) => ({ ...game, status: "postponed" })) }], ["no season year", { season: { ...SEASON, season_year: null } }]]) {
    start(over);
    for (const id of ["bowl_pool_open", "bowl_pool_last_call"]) {
      const preview = await previewOf(id);
      assert.equal(preview.status, 409, `${name}: ${id} preview`);
      assert.match(preview.body.error, /nothing to preview/);
    }
    const test = await sent("bowl_pool_open");
    assert.equal(test.status, 409, `${name}: test send`);
    assert.equal(inserted().length, 0, `${name}: no test row`);
    assert.equal(bowlPreviewFixture.delivered.length, 0, `${name}: nothing delivered`);
  }
});

test("their wording can be looked at but never saved or reset, while a standard email still can", async () => {
  start();
  for (const id of ["bowl_pool_open", "bowl_pool_last_call"]) {
    assert.equal(reminderTemplate(id).readOnly, true);
    assert.equal((await call(() => saveWording(json("/api/admin/reminder-templates", "PUT", { id, title: "New subject", message: "New words" })))).status, 400, `${id} save`);
    assert.equal((await call(() => resetWording(json(`/api/admin/reminder-templates?id=${id}`, "DELETE")))).status, 400, `${id} reset`);
  }
  assert.equal(database.queries.length, 0, "a refused change never reaches the database");
  assert.equal((await call(() => saveWording(json("/api/admin/reminder-templates", "PUT", { id: "weekly", title: "New subject", message: "New words" })))).status, 200);
  assert.equal((await call(() => resetWording(json("/api/admin/reminder-templates?id=weekly", "DELETE")))).status, 200);
});

test("a test send goes to the Commissioner alone as a test row, with the same words the sweep would queue and no automation key", async () => {
  for (const [template, expected] of [["bowl_pool_open", expectedOpening()], ["bowl_pool_last_call", expectedLastCall()]]) {
    start();
    const { status, body } = await sent(template);
    assert.equal(status, 200, template);
    assert.match(body.message, template === "bowl_pool_open" ? /opening announcement sent to your email/ : /last call sent to your email/);
    const [row] = inserted();
    assert.deepEqual({ category: row.category, audience: row.audience, status: row.status, title: row.title, body: row.body, created_by_player_id: row.created_by_player_id }, { category: template, audience: "all_active", status: "test", title: expected.title, body: expected.body, created_by_player_id: "commissioner-1" });
    assert.deepEqual(row.recap_snapshot, expected.snapshot);
    assert.equal(row.automation_key, undefined, "a test never takes the once-only key of the real message");
    assert.equal(row.source_game_ids, undefined);
    assert.equal(bowlPreviewFixture.delivered.length, 1);
    const [reminder, playerId, address] = bowlPreviewFixture.delivered[0];
    assert.deepEqual({ category: reminder.category, title: reminder.title, body: reminder.body, snapshot: reminder.recap_snapshot, playerId, address }, { category: template, title: expected.title, body: expected.body, snapshot: expected.snapshot, playerId: "commissioner-1", address: "commissioner@example.com" });
  }
});

test("the plain delivery test is unchanged, and a missing, malformed or unknown test name is just the plain test", async () => {
  for (const send of [() => sent(), () => sent("no-such-message"), () => sentWithBody("not json"), () => sentWithBody("")]) {
    start();
    assert.equal((await send()).status, 200);
    const [row] = inserted();
    assert.deepEqual({ category: row.category, title: row.title, body: row.body, status: row.status, recap_snapshot: row.recap_snapshot }, { category: "custom", title: "Joe Barr Pick'em test", body: "Email reminders are working for your Pick'em account.", status: "test", recap_snapshot: undefined });
    assert.equal(bowlPreviewFixture.delivered.length, 1);
  }
});

test("the selections preview uses the Sunday selections reminder's saved words, or the standard ones, and reaches the Commissioner alone", async () => {
  for (const [saved, expected] of [
    [{ title: "Saved subject", body: "Saved message" }, { title: "Saved subject", body: "Saved message" }],
    [null, { title: "Selections still to be made", body: "A friendly reminder: there is still time to take care of anything waiting for you. Open the pool when you are ready." }],
  ]) {
    start({ selectionWording: saved });
    assert.equal((await sent("selections")).status, 200);
    const [row] = inserted();
    assert.deepEqual({ category: row.category, title: row.title, body: row.body, status: row.status }, { category: "custom", ...expected, status: "test" });
    assert.deepEqual(database.queries.map((query) => query.table).sort(), ["players", "push_reminders", "reminder_templates"], "no player is looked up to be emailed");
    assert.deepEqual(bowlPreviewFixture.delivered.map(([, playerId, address]) => [playerId, address]), [["commissioner-1", "commissioner@example.com"]]);
  }
});

test("with email reminders off, the Bowl test says to turn them on and sends nothing", async () => {
  start({ commissioner: { notification_email: null, email_notifications_enabled: false } });
  const { status, body } = await sent("bowl_pool_last_call");
  assert.equal(status, 409);
  assert.match(body.error, /Turn on email reminders/);
  assert.equal(bowlPreviewFixture.delivered.length, 0);
});
