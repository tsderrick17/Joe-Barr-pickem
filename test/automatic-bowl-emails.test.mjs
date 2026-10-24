import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import { insertedRow, recordingDatabase } from "./helpers/recording-database.mjs";

// The Bowl Pool email scheduler, run for real against a scripted database: which emails it queues for which games and days, when each becomes due, and how it treats
// an email that is already queued (quietly skipped) or cannot be queued (a failure).
const SEASON = { id: "bowl-26", status: "open" };
// Dec 20 (Sat): two games, the first locks at 11:00 ET; Dec 21 (Sun): one game.
const GAMES = [
  { id: "g1", kickoff_at: "2026-12-20T17:00:00Z", line_lock_at: "2026-12-20T16:00:00Z", status: "scheduled" },
  { id: "g2", kickoff_at: "2026-12-20T21:00:00Z", line_lock_at: "2026-12-20T20:00:00Z", status: "scheduled" },
  { id: "g3", kickoff_at: "2026-12-21T18:00:00Z", line_lock_at: "2026-12-21T17:00:00Z", status: "scheduled" },
];
let seasons, commissioner, games, insertError, database;
const respond = (table, calls) => {
  if (table === "bowl_pool_seasons") return { data: seasons, error: null };
  if (table === "players") return { data: commissioner, error: null };
  if (table === "bowl_pool_games") return { data: games, error: null };
  if (table === "push_reminders") {
    const row = insertedRow(calls);
    return insertError?.(row) ?? { data: null, error: null };
  }
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlEmailFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlEmailFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { ensureAutomaticBowlPoolEmails } = await import("../src/lib/automatic-bowl-pool-emails.ts");
const run = (now, { over = {} } = {}) => {
  seasons = over.seasons ?? [SEASON]; commissioner = "commissioner" in over ? over.commissioner : { id: "c1" };
  games = over.games ?? GAMES; insertError = over.insertError ?? null;
  database = recordingDatabase(respond); bowlEmailFixture.database = database;
  return ensureAutomaticBowlPoolEmails(new Date(now));
};
const queued = () => database.queries.filter((query) => query.table === "push_reminders").map((query) => insertedRow(query.calls)).filter(Boolean);
const keys = () => queued().map((row) => row.automation_key).sort();

test("with no open Bowl season nothing is queued and no sender is looked up", async () => {
  assert.deepEqual(await run("2026-12-01T12:00:00Z", { over: { seasons: [] } }), { created: 0, reason: "no_active_bowl_season" });
  assert.deepEqual(queued(), []);
  assert.ok(!database.queries.some((query) => query.table === "players"));
});

test("before the games, each game day gets one lines-are-set email and each game its own pick-due reminder", async () => {
  const result = await run("2026-12-01T12:00:00Z");
  assert.deepEqual(result, { created: 5, reason: null });
  assert.deepEqual(keys(), [
    "bowl:bowl-26:line-lock:2026-12-20", "bowl:bowl-26:line-lock:2026-12-21",
    "bowl:bowl-26:pick-due:g1", "bowl:bowl-26:pick-due:g2", "bowl:bowl-26:pick-due:g3",
  ]);
  const lineLock = queued().find((row) => row.automation_key.endsWith("line-lock:2026-12-20"));
  assert.equal(lineLock.category, "bowl_line_lock");
  assert.equal(lineLock.scheduled_for, "2026-12-20T16:00:00Z", "due at the day's earliest line lock");
  assert.deepEqual(lineLock.source_game_ids, ["g1", "g2"], "covering that day's games only");
  assert.equal(lineLock.created_by_player_id, "c1");
  const reminder = queued().find((row) => row.automation_key.endsWith("pick-due:g1"));
  assert.equal(reminder.category, "bowl_pick_due");
  assert.equal(reminder.scheduled_for, "2026-12-20T14:00:00.000Z", "three hours before that game's kickoff");
  assert.deepEqual(reminder.source_game_ids, ["g1"]);
});

test("no recap is queued until the morning after its game day, then one per day covering that day's games", async () => {
  await run("2026-12-21T09:00:00Z");   // 4 AM ET Dec 21: Saturday's recap is not due until 5 AM
  assert.ok(!keys().some((key) => key.includes("daily-recap")), "not yet");
  await run("2026-12-21T11:00:00Z");   // 6 AM ET Dec 21
  const recap = queued().find((row) => row.category === "bowl_daily_recap");
  assert.equal(recap.automation_key, "bowl:bowl-26:daily-recap:2026-12-20");
  assert.equal(recap.scheduled_for, "2026-12-21T10:00:00.000Z", "5 AM Eastern the next morning");
  assert.deepEqual(recap.source_game_ids, ["g1", "g2"]);
  assert.equal(keys().filter((key) => key.includes("daily-recap")).length, 1, "Sunday's is not due yet");
});

test("a game whose reminder time has passed, or that is no longer scheduled, gets no pick-due reminder", async () => {
  await run("2026-12-20T15:00:00Z");   // 10 AM ET Dec 20: g1's reminder (9 AM ET) has passed
  assert.ok(!keys().includes("bowl:bowl-26:pick-due:g1"), "its time has gone by");
  assert.ok(keys().includes("bowl:bowl-26:pick-due:g2"));
  await run("2026-12-01T12:00:00Z", { over: { games: GAMES.map((game) => game.id === "g2" ? { ...game, status: "postponed" } : game) } });
  assert.ok(!keys().includes("bowl:bowl-26:pick-due:g2"), "a postponed game is not reminded about");
  assert.ok(keys().includes("bowl:bowl-26:pick-due:g3"));
});

test("an email already queued is skipped without counting or failing, and any other queueing error is a failure", async () => {
  const duplicate = await run("2026-12-01T12:00:00Z", { over: { insertError: () => ({ data: null, error: { code: "23505" } }) } });
  assert.deepEqual(duplicate, { created: 0, reason: null });
  await assert.rejects(run("2026-12-01T12:00:00Z", { over: { insertError: () => ({ data: null, error: { code: "XX000" } }) } }), /could not be queued/);
});

test("without an active commissioner to send as, nothing is queued", async () => {
  await assert.rejects(run("2026-12-01T12:00:00Z", { over: { commissioner: null } }), /commissioner sender/);
  assert.deepEqual(queued(), []);
});
