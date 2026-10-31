import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { insertedRow, recordingDatabase } from "./helpers/recording-database.mjs";

// The one-time "the Bowl Pool is open" email and phone notification, December 7 at 9 AM Eastern: its words (the copy the owner approved), when it is
// queued and for whom it is ready, what the email and the phone notification look like, and that it can only ever be queued once.
const SEASON = { id: "bowl-26", status: "open", season_year: 2026, championship_game_id: "title" };
const GAMES = [
  { id: "first", bowl_name: "Salute to Veterans", kickoff_at: "2026-12-15T22:30:00Z", line_lock_at: "2026-12-15T13:00:00Z", status: "scheduled", time_confirmed: true },
  { id: "second", bowl_name: "Cure", kickoff_at: "2026-12-16T22:30:00Z", line_lock_at: "2026-12-16T13:00:00Z", status: "scheduled", time_confirmed: true },
  { id: "title", bowl_name: "National Championship", kickoff_at: "2027-01-26T00:30:00Z", line_lock_at: "2027-01-25T13:00:00Z", status: "scheduled", time_confirmed: false },
];
let seasons, games, insertError, seasonRow, database;
const respond = (table, calls) => {
  if (table === "bowl_pool_seasons") return calls.some(([name]) => name === "maybeSingle") ? { data: seasonRow, error: null } : { data: seasons, error: null };
  if (table === "players") return { data: { id: "c1" }, error: null };
  if (table === "bowl_pool_games") return calls.some(([name]) => name === "maybeSingle") ? { data: games[0] ? { season_id: "bowl-26" } : null, error: null } : { data: games, error: null };
  if (table === "push_reminders") return insertError?.(insertedRow(calls)) ?? { data: null, error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlOpeningFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlOpeningFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { bowlOpeningAnnouncementAt, bowlOpeningMessage, bowlSpokenName, BOWL_OPENING_EMAIL_SUBJECT } = await import("../src/lib/bowl-opening-announcement.js");
const { ensureAutomaticBowlPoolEmails } = await import("../src/lib/automatic-bowl-pool-emails.ts");
const { reminderReadiness } = await import("../src/lib/reminder-readiness.ts");
const { messageHtml } = await import("../src/lib/email-reminders.ts");
const { reminderPushMessage, reminderDestinationPath } = await import("../src/lib/reminder-push.js");
const { emailPreferenceColumn } = await import("../src/lib/email-plan-preferences.js");

const sweep = (now, over = {}) => {
  seasons = over.seasons ?? [SEASON]; games = over.games ?? GAMES; insertError = over.insertError ?? null;
  database = recordingDatabase(respond); bowlOpeningFixture.database = database;
  return ensureAutomaticBowlPoolEmails(new Date(now));
};
const opening = () => database.queries.filter((query) => query.table === "push_reminders").map((query) => insertedRow(query.calls)).filter((row) => row?.category === "bowl_pool_open");
const message = bowlOpeningMessage({ seasonYear: 2026, firstGame: GAMES[0], finalGameKickoffAt: GAMES[2].kickoff_at });

test("the words are the ones the owner approved, filled in from the schedule", () => {
  assert.equal(bowlOpeningAnnouncementAt(2026), "2026-12-07T14:00:00.000Z", "9 AM Eastern on December 7");
  assert.equal(message.title, "The Bowl Pool is open");
  assert.equal(message.body, "Claim your seat and pick every bowl and playoff game against the spread. First game: Tue, Dec 15.");
  assert.equal(BOWL_OPENING_EMAIL_SUBJECT, "The Bowl Pool is open: claim your seat");
  assert.equal(message.snapshot.intro, "The 2026–27 Bowl Pool is open. Pick every bowl and College Football Playoff game against the spread, all the way through the National Championship on Jan 25.");
  assert.deepEqual(message.snapshot.steps, [
    "Claim your seat. The Bowl Pool is separate from the NFL pool, so you join it on its own.",
    "Every correct pick against the spread is one point.",
    "Lines lock at 8 AM Eastern on game day, and each pick locks at that game's kickoff.",
    "Pick now or come back later. You can change any pick until its kickoff.",
    "The tiebreaker is the total points scored in the National Championship.",
    "The first game is the Salute to Veterans Bowl on Tuesday, Dec 15. You can opt out any time before then.",
  ]);
  assert.equal(bowlOpeningMessage({ seasonYear: 2026, firstGame: GAMES[0] }).snapshot.intro.endsWith("all the way through the National Championship."), true, "no date until the title game has one");
});

test("a bowl is named the way people say it", () => {
  assert.equal(bowlSpokenName("Fiesta"), "Fiesta Bowl");
  assert.equal(bowlSpokenName("Salute to Veterans"), "Salute to Veterans Bowl");
  assert.equal(bowlSpokenName("Duke's Mayo"), "Duke's Mayo Bowl");
  assert.equal(bowlSpokenName("National Championship"), "National Championship");
  assert.equal(bowlSpokenName("CFP First Round 1"), "CFP First Round 1");
  assert.equal(bowlSpokenName(null), "first bowl game");
});

test("it is queued once the morning it is due, from the schedule as it stands, and never before", async () => {
  await sweep("2026-12-07T13:59:00Z");
  assert.deepEqual(opening(), [], "9 AM Eastern has not come");
  await sweep("2026-12-07T14:00:00Z");
  const [row] = opening();
  assert.equal(opening().length, 1);
  assert.equal(row.automation_key, "bowl:bowl-26:open");
  assert.equal(row.audience, "all_active", "to everyone, not only those with a seat");
  assert.equal(row.scheduled_for, "2026-12-07T14:00:00.000Z");
  assert.deepEqual(row.source_game_ids, ["first"]);
  assert.equal(row.title, message.title);
  assert.equal(row.body, message.body);
  assert.deepEqual(row.recap_snapshot, message.snapshot);
  // The first game moved a day later before the announcement went out: the words follow the schedule.
  await sweep("2026-12-07T14:00:00Z", { games: GAMES.map((game) => game.id === "first" ? { ...game, kickoff_at: "2026-12-17T22:30:00Z" } : game) });
  assert.match(opening()[0].body, /First game: Wed, Dec 16\.$/, "the earliest game still scheduled is the first game now");
});

test("it is never queued twice, for a finished season or one without a year, or once a game has kicked off", async () => {
  assert.deepEqual(await sweep("2026-12-07T14:00:00Z", { insertError: () => ({ data: null, error: { code: "23505" } }) }), { created: 0, reason: null }, "a key already taken is quietly skipped");
  await sweep("2026-12-07T14:00:00Z", { seasons: [{ ...SEASON, status: "complete" }] });
  assert.deepEqual(opening(), []);
  await sweep("2026-12-07T14:00:00Z", { seasons: [{ id: "bowl-26", status: "open" }] });
  assert.deepEqual(opening(), []);
  await sweep("2026-12-15T23:00:00Z");
  assert.deepEqual(opening(), [], "seats close at the first kickoff, so the invitation is never sent after it");
  await sweep("2026-12-07T14:00:00Z", { games: GAMES.map((game) => ({ ...game, status: "postponed" })) });
  assert.deepEqual(opening(), [], "with no game left to play there is nothing to open");
});

test("it is ready until the first game starts, and then it is dropped for good", async () => {
  database = recordingDatabase(respond); bowlOpeningFixture.database = database; games = GAMES;
  const at = async (now, run) => { mock.timers.enable({ apis: ["Date"], now: Date.parse(now) }); try { return await run(); } finally { mock.timers.reset(); } };
  seasonRow = { first_kickoff_at: "2026-12-15T22:30:00Z" };
  assert.deepEqual(await at("2026-12-07T14:00:00Z", () => reminderReadiness("bowl_pool_open", ["first"])), { ready: true, reason: null });
  const started = await at("2026-12-15T22:31:00Z", () => reminderReadiness("bowl_pool_open", ["first"]));
  assert.deepEqual({ ready: started.ready, terminal: started.terminal }, { ready: false, terminal: true });
  assert.equal((await reminderReadiness("bowl_pool_open", [])).terminal, true, "a message with no first game is dropped");
  assert.equal((await reminderReadiness("bowl_pool_open", ["first", "second"])).terminal, true);
});

test("the email shows the introduction, the steps, and a Claim your seat button; the phone notification carries the short words and opens the Bowl Pool", () => {
  const reminder = { id: "r1", category: "bowl_pool_open", audience: "all_active", title: message.title, body: message.body, recap_snapshot: message.snapshot };
  const html = messageHtml(reminder);
  assert.match(html, /BOWL POOL/);
  assert.match(html, /<h1[^>]*>The Bowl Pool is open<\/h1>/);
  assert.ok(html.includes("all the way through the National Championship on Jan 25."));
  assert.ok(html.includes("How it works"));
  for (const step of message.snapshot.steps) assert.ok(html.includes(step.replace("'", "&#39;")) || html.includes(step), step);
  assert.match(html, /<a href="https:\/\/[^"]*\/bowl-pool"[^>]*>Claim your seat<\/a>/);
  assert.ok(!html.includes("First game: Tue, Dec 15."), "the email carries the long form, not the phone words");

  const push = reminderPushMessage({ id: "r1", category: "bowl_pool_open", title: message.title, body: message.body });
  assert.deepEqual({ title: push.title, body: push.body, url: push.url }, { title: "The Bowl Pool is open", body: message.body, url: "/bowl-pool" });
  assert.equal(reminderDestinationPath("bowl_pool_open"), "/bowl-pool");

  const damaged = messageHtml({ ...reminder, recap_snapshot: { kind: "bowl_pool_open", intro: 3, steps: "no" } });
  assert.ok(damaged.includes("Claim your seat and pick every bowl"), "words that cannot be read fall back to the short message");
  assert.ok(!damaged.includes("How it works"));
  assert.equal(emailPreferenceColumn("bowl_pool_open"), "email_notifications_enabled", "it goes to everyone who has pool emails on");
});
