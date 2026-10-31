import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { insertedRow, recordingDatabase } from "./helpers/recording-database.mjs";

// The one-time "last call" email and phone notification, 24 hours before the first Bowl kickoff, to the players who have not joined the Bowl Pool:
// its words, when it is queued and for whom it is ready, who receives it, and that it can only ever be queued once.
const SEASON = { id: "bowl-26", status: "open", season_year: 2026, championship_game_id: "title" };
const GAMES = [
  { id: "first", bowl_name: "Salute to Veterans", kickoff_at: "2026-12-15T22:30:00Z", line_lock_at: "2026-12-15T13:00:00Z", status: "scheduled", time_confirmed: true },
  { id: "second", bowl_name: "Cure", kickoff_at: "2026-12-16T22:30:00Z", line_lock_at: "2026-12-16T13:00:00Z", status: "scheduled", time_confirmed: true },
  { id: "title", bowl_name: "National Championship", kickoff_at: "2027-01-26T00:30:00Z", line_lock_at: "2027-01-25T13:00:00Z", status: "scheduled", time_confirmed: false },
];
const LAST_CALL_AT = "2026-12-14T22:30:00.000Z";
let seasons, games, insertError, seasonRow, players, entries, database;
const respond = (table, calls) => {
  const one = calls.some(([name]) => name === "maybeSingle");
  if (table === "bowl_pool_seasons") return one ? { data: seasonRow, error: null } : { data: seasons, error: null };
  if (table === "players") return one ? { data: { id: "c1" }, error: null } : { data: players, error: null };
  if (table === "bowl_pool_games") return one ? { data: { season_id: "bowl-26" }, error: null } : { data: games, error: null };
  if (table === "bowl_pool_entries") return { data: entries, error: null };
  if (table === "push_reminders") return insertError?.(insertedRow(calls)) ?? { data: null, error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlLastCallFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlLastCallFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { bowlLastCallAt, bowlLastCallMessage, BOWL_LAST_CALL_EMAIL_SUBJECT } = await import("../src/lib/bowl-opening-announcement.js");
const { ensureAutomaticBowlPoolEmails } = await import("../src/lib/automatic-bowl-pool-emails.ts");
const { reminderReadiness } = await import("../src/lib/reminder-readiness.ts");
const { messageHtml, bowlLastCallRecipients } = await import("../src/lib/email-reminders.ts");
const { reminderPushMessage, reminderDestinationPath } = await import("../src/lib/reminder-push.js");
const { emailPreferenceColumn } = await import("../src/lib/email-plan-preferences.js");

const sweep = (now, over = {}) => {
  seasons = over.seasons ?? [SEASON]; games = over.games ?? GAMES; insertError = over.insertError ?? null;
  database = recordingDatabase(respond); bowlLastCallFixture.database = database;
  return ensureAutomaticBowlPoolEmails(new Date(now));
};
const lastCalls = () => database.queries.filter((query) => query.table === "push_reminders").map((query) => insertedRow(query.calls)).filter((row) => row?.category === "bowl_pool_last_call");
const message = bowlLastCallMessage({ firstGame: GAMES[0] });

test("the words say when the first game starts, in Eastern time, and when entry closes", () => {
  assert.equal(bowlLastCallAt("2026-12-15T22:30:00Z"), LAST_CALL_AT, "24 hours before the first kickoff");
  assert.equal(message.title, "Last call for the Bowl Pool");
  assert.equal(message.body, "The first game kicks off Tue, Dec 15 at 5:30 PM ET, and entry closes then. Claim your seat now.");
  assert.equal(BOWL_LAST_CALL_EMAIL_SUBJECT, "Last call: claim your Bowl Pool seat");
  assert.equal(message.snapshot.kind, "bowl_pool_last_call");
  assert.equal(message.snapshot.intro, "The Bowl Pool's first game, the Salute to Veterans Bowl, kicks off Tuesday, Dec 15 at 5:30 PM ET. You haven't claimed your seat yet, and entry closes at that kickoff.");
  assert.equal(message.snapshot.steps.length, 3);
  assert.match(bowlLastCallMessage({ firstGame: { bowl_name: "Cure", kickoff_at: "2026-12-16T17:00:00Z" } }).body, /Wed, Dec 16 at 12:00 PM ET/, "winter time is Eastern standard");
});

test("it is queued once, 24 hours before the first kickoff, and never before", async () => {
  await sweep("2026-12-14T22:29:00Z");
  assert.deepEqual(lastCalls(), [], "24 hours before has not come");
  await sweep(LAST_CALL_AT);
  const [row] = lastCalls();
  assert.equal(lastCalls().length, 1);
  assert.equal(row.automation_key, "bowl:bowl-26:last-call");
  assert.equal(row.audience, "all_active", "who has not joined is decided when it is sent");
  assert.equal(row.scheduled_for, LAST_CALL_AT);
  assert.deepEqual(row.source_game_ids, ["first"]);
  assert.equal(row.title, message.title);
  assert.equal(row.body, message.body);
  assert.deepEqual(row.recap_snapshot, message.snapshot);
  assert.deepEqual((await sweep("2026-12-15T10:00:00Z", { insertError: () => ({ data: null, error: { code: "23505" } }) })), { created: 0, reason: null }, "a key already taken is quietly skipped");
});

test("when the first game moves, the call follows the game that is first now; with a postponed first game, no confirmed time, a finished season or a kickoff behind it, there is no call", async () => {
  // The first game is moved a day and a half later: the game that is first now is the one the 24 hours count back from.
  const moved = GAMES.map((game) => game.id === "first" ? { ...game, kickoff_at: "2026-12-17T22:30:00Z" } : game);
  await sweep("2026-12-14T22:30:00Z", { games: moved });
  assert.deepEqual(lastCalls(), [], "the next game is a day later, so the call is a day later");
  await sweep("2026-12-15T22:30:00Z", { games: moved });
  assert.deepEqual(lastCalls().map((row) => [row.source_game_ids, row.scheduled_for]), [[["second"], "2026-12-15T22:30:00.000Z"]]);
  await sweep("2026-12-15T22:30:00Z", { games: GAMES.map((game) => game.id === "first" ? { ...game, status: "postponed" } : game) });
  assert.deepEqual(lastCalls(), [], "a postponed first game whose time has come still closes entry, so there is no call");
  await sweep("2026-12-14T22:30:00Z", { games: GAMES.map((game) => game.id === "first" ? { ...game, time_confirmed: false } : game) });
  assert.deepEqual(lastCalls(), [], "a guessed time cannot be counted back from");
  await sweep("2026-12-14T22:30:00Z", { seasons: [{ ...SEASON, status: "complete" }] });
  assert.deepEqual(lastCalls(), []);
  await sweep("2026-12-14T22:30:00Z", { seasons: [{ id: "bowl-26", status: "open", championship_game_id: "title" }] });
  assert.deepEqual(lastCalls().length, 1, "it does not need the season year");
  await sweep("2026-12-15T22:31:00Z");
  assert.deepEqual(lastCalls(), [], "seats close at the first kickoff, so the call is never sent after it");
});

test("it is ready until the first game starts, and then it is dropped for good", async () => {
  database = recordingDatabase(respond); bowlLastCallFixture.database = database; games = GAMES;
  const at = async (now, run) => { mock.timers.enable({ apis: ["Date"], now: Date.parse(now) }); try { return await run(); } finally { mock.timers.reset(); } };
  seasonRow = { first_kickoff_at: "2026-12-15T22:30:00Z" };
  assert.deepEqual(await at(LAST_CALL_AT, () => reminderReadiness("bowl_pool_last_call", ["first"])), { ready: true, reason: null });
  const started = await at("2026-12-15T22:31:00Z", () => reminderReadiness("bowl_pool_last_call", ["first"]));
  assert.deepEqual({ ready: started.ready, terminal: started.terminal }, { ready: false, terminal: true });
  assert.equal((await reminderReadiness("bowl_pool_last_call", [])).terminal, true, "a message with no first game is dropped");
});

test("it goes to players who have not joined: active, emails on, an address, and no Bowl entry of any kind", async () => {
  players = [{ id: "joined", notification_email: "joined@example.com" }, { id: "left", notification_email: "left@example.com" }, { id: "new", notification_email: "new@example.com" }, { id: "no-address", notification_email: null }];
  entries = [{ player_id: "joined" }, { player_id: "left" }];
  database = recordingDatabase(respond); bowlLastCallFixture.database = database;
  const recipients = await bowlLastCallRecipients({ id: "r1", category: "bowl_pool_last_call", source_game_ids: ["first"] });
  assert.deepEqual(recipients, [{ playerId: "new", email: "new@example.com" }], "a player who joined and then opted out chose to leave, so is not asked again");
  const called = (table, name) => database.queries.find((query) => query.table === table).calls.filter(([method]) => method === name).map(([, args]) => args);
  assert.deepEqual(called("players", "eq"), [["active", true], ["email_notifications_enabled", true]]);
  assert.deepEqual(called("players", "not"), [["notification_email", "is", null]]);
  assert.deepEqual(called("bowl_pool_entries", "eq"), [["season_id", "bowl-26"]], "every entry of the season counts, whatever its status");
  assert.deepEqual(await bowlLastCallRecipients({ id: "r2", category: "bowl_pool_last_call", source_game_ids: [] }), [], "no game, no season, no one to ask");
});

test("the email shows the introduction, the steps and a Claim your seat button; the phone notification opens the Bowl Pool", () => {
  const reminder = { id: "r1", category: "bowl_pool_last_call", audience: "all_active", title: message.title, body: message.body, recap_snapshot: message.snapshot };
  const html = messageHtml(reminder);
  assert.match(html, /BOWL POOL/);
  assert.match(html, /<h1[^>]*>Last call for the Bowl Pool<\/h1>/);
  assert.ok(html.includes("kicks off Tuesday, Dec 15 at 5:30 PM ET. You haven&#39;t claimed your seat yet") || html.includes("kicks off Tuesday, Dec 15 at 5:30 PM ET. You haven't claimed your seat yet"));
  assert.ok(html.includes("How it works"));
  for (const step of message.snapshot.steps) assert.ok(html.includes(step), step);
  assert.match(html, /<a href="https:\/\/[^"]*\/bowl-pool"[^>]*>Claim your seat<\/a>/);
  const push = reminderPushMessage({ id: "r1", category: "bowl_pool_last_call", title: message.title, body: message.body });
  assert.deepEqual({ title: push.title, body: push.body, url: push.url }, { title: "Last call for the Bowl Pool", body: message.body, url: "/bowl-pool" });
  assert.equal(reminderDestinationPath("bowl_pool_last_call"), "/bowl-pool");
  assert.equal(emailPreferenceColumn("bowl_pool_last_call"), "email_notifications_enabled");
});
