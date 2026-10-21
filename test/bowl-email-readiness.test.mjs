import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";
import { bowlDailyRecapAt, bowlGamedays, unpickedBowlReminderAt } from "../src/lib/bowl-email-schedule.js";

// When a Bowl email may go out, run through the real readiness check with its database scripted, and the schedule rules it is queued by.
let games = [];
let lines = [];
const respond = (table, calls) => {
  const single = calls.some(([name]) => name === "maybeSingle");
  if (table === "bowl_pool_games") return { data: single ? games[0] ?? null : games, error: null };
  if (table === "bowl_pool_game_lines") return { data: lines, error: null };
  return { data: [], error: null };
};
globalThis.bowlReadinessFixture = { database: recordingDatabase(respond) };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlReadinessFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { reminderReadiness } = await import("../src/lib/reminder-readiness.ts");
const at = async (now, run) => { mock.timers.enable({ apis: ["Date"], now: Date.parse(now) }); try { return await run(); } finally { mock.timers.reset(); } };

test("a Bowl recap goes out only when every game of the day is over (final, cancelled, postponed or no contest)", async () => {
  games = [{ status: "final" }, { status: "cancelled" }, { status: "no_contest" }, { status: "postponed" }];
  assert.deepEqual(await reminderReadiness("bowl_daily_recap", ["a", "b", "c", "d"]), { ready: true, reason: null });
  games = [{ status: "final" }, { status: "live" }];
  assert.deepEqual(await reminderReadiness("bowl_daily_recap", ["a", "b"]), { ready: false, reason: "This Bowl game day is still in progress." });
  const missing = await reminderReadiness("bowl_daily_recap", ["a", "b", "c"]);
  assert.equal(missing.terminal, true, "a recap whose game no longer exists is dropped, not retried");
  assert.equal((await reminderReadiness("bowl_daily_recap", [])).terminal, true, "a recap with no games is dropped");
});

test("a Bowl pick reminder is dropped once its game has kicked off or is no longer scheduled", async () => {
  games = [{ kickoff_at: "2026-12-20T17:00:00Z", status: "scheduled" }];
  assert.deepEqual(await at("2026-12-20T14:00:00Z", () => reminderReadiness("bowl_pick_due", ["g"])), { ready: true, reason: null });
  const kickedOff = await at("2026-12-20T17:00:01Z", () => reminderReadiness("bowl_pick_due", ["g"]));
  assert.deepEqual({ ready: kickedOff.ready, terminal: kickedOff.terminal }, { ready: false, terminal: true });
  games = [{ kickoff_at: "2026-12-20T17:00:00Z", status: "postponed" }];
  assert.equal((await at("2026-12-20T14:00:00Z", () => reminderReadiness("bowl_pick_due", ["g"]))).terminal, true);
  assert.equal((await reminderReadiness("bowl_pick_due", ["g", "h"])).terminal, true, "a reminder is for exactly one game");
});

test("the Bowl lines email waits until every playable game's line is locked, and ignores games that will not be played", async () => {
  games = [{ id: "a", line_lock_at: "2026-12-20T13:00:00Z", status: "scheduled" }, { id: "b", line_lock_at: "2026-12-20T13:00:00Z", status: "scheduled" }, { id: "c", line_lock_at: "2026-12-20T13:00:00Z", status: "postponed" }];
  lines = [{ game_id: "a", locked_at: "2026-12-20T13:00:00Z" }];
  assert.equal((await at("2026-12-20T15:00:00Z", () => reminderReadiness("bowl_line_lock", ["a", "b", "c"]))).ready, false, "b has no locked line yet");
  lines = [{ game_id: "a", locked_at: "2026-12-20T13:00:00Z" }, { game_id: "b", locked_at: "2026-12-20T13:00:01Z" }];
  assert.equal((await at("2026-12-20T15:00:00Z", () => reminderReadiness("bowl_line_lock", ["a", "b", "c"]))).ready, true, "the postponed game does not hold it back");
  assert.equal((await at("2026-12-20T12:00:00Z", () => reminderReadiness("bowl_line_lock", ["a", "b", "c"]))).ready, false, "not before the lines are due to lock");
  games = [{ id: "c", line_lock_at: "2026-12-20T13:00:00Z", status: "cancelled" }];
  assert.equal((await reminderReadiness("bowl_line_lock", ["c"])).terminal, true, "nothing playable is left: dropped");
});

test("the daily recap is queued for 5 AM Eastern the morning after a game day, and the pick reminder three hours before kickoff", () => {
  assert.equal(bowlDailyRecapAt("2026-12-20"), "2026-12-21T10:00:00.000Z");   // winter: Eastern is UTC-5
  assert.equal(bowlDailyRecapAt("2027-01-01"), "2027-01-02T10:00:00.000Z");
  assert.equal(unpickedBowlReminderAt("2026-12-20T17:00:00Z"), "2026-12-20T14:00:00.000Z");
  // a game day is the Eastern calendar day: a 9 PM Eastern kickoff belongs to that evening, not to the next UTC day
  assert.deepEqual(bowlGamedays([{ kickoff_at: "2026-12-21T02:00:00Z" }, { kickoff_at: "2026-12-20T17:00:00Z" }, { kickoff_at: "2026-12-22T01:00:00Z" }]), ["2026-12-20", "2026-12-21"]);
});
