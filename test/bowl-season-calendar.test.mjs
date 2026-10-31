import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

// The Bowl season's reminders, rehearsed day by day from December 1 to January 27 with the real 2026 calendar (the 42 seeded games and the five
// added after September): the reminder sweep runs every hour against a database that remembers what it was given and refuses a reminder
// whose key is already taken, as the real one does. One game gets its time announced late, another is rescheduled. At the end every game
// day has exactly one lines-are-set email and one recap, every game has exactly one pick-due reminder 3 hours before its kickoff, a recap
// is queued only once it is due, and nothing was queued twice.
const HOUR = 60 * 60 * 1000;
const seeded = JSON.parse(await readFile(new URL("./fixtures/bowl-pool-seeded-2026.json", import.meta.url), "utf8"));
// December to January is Eastern Standard Time (UTC-5), so an Eastern clock time is simply five hours behind UTC.
const easternDay = (iso) => new Date(Date.parse(iso) - 5 * HOUR).toISOString().slice(0, 10);
const eightAm = (day) => `${day}T13:00:00.000Z`;
const fiveAmNextDay = (day) => new Date(Date.parse(`${day}T10:00:00.000Z`) + 24 * HOUR).toISOString();
const asGame = (row) => ({ id: row.id, kickoff_at: row.kickoff_at, line_lock_at: eightAm(easternDay(row.kickoff_at)), status: "scheduled", time_confirmed: row.time_confirmed });
const added = [
  ["san-juan", "2026-12-16T17:00:00.000Z", false],
  ["poinsettia", "2026-12-24T00:30:00.000Z", true],
  ["holiday", "2026-12-28T22:00:00.000Z", true],
  ["sun", "2026-12-31T19:00:00.000Z", true],
  ["arizona", "2027-01-02T21:30:00.000Z", true],
];

let games, reminders, clock;
const respond = (table, calls) => {
  if (table === "bowl_pool_seasons") return { data: [{ id: "bowl-26", status: "open", season_year: 2026, championship_game_id: null }], error: null };
  if (table === "players") return { data: { id: "commissioner-1" }, error: null };
  if (table === "bowl_pool_games") return { data: games.map((game) => ({ ...game })), error: null };
  if (table !== "push_reminders") throw new Error(`unexpected table ${table}`);
  const insert = calls.find(([name]) => name === "insert");
  if (insert) {
    const row = insert[1][0];
    if (row.automation_key && reminders.some((reminder) => reminder.automation_key === row.automation_key)) return { data: null, error: { code: "23505" } };
    reminders.push({ ...row, status: "scheduled", queuedAt: clock });
    return { data: null, error: null };
  }
  const update = calls.find(([name]) => name === "update");
  const categories = calls.find(([name]) => name === "in")[1][1];
  const [, [gameId]] = calls.find(([name]) => name === "contains")[1];
  for (const reminder of reminders) {
    if (reminder.status === "scheduled" && categories.includes(reminder.category) && reminder.source_game_ids.includes(gameId)) Object.assign(reminder, update[1][0]);
  }
  return { data: null, error: null };
};
globalThis.bowlCalendarFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlCalendarFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { recordingDatabase } = await import("./helpers/recording-database.mjs");
const { ensureAutomaticBowlPoolEmails } = await import("../src/lib/automatic-bowl-pool-emails.ts");
const { cancelQueuedBowlReminders } = await import("../src/lib/bowl-reminders.ts");

const sweepAt = async (time) => { clock = new Date(time).toISOString(); return ensureAutomaticBowlPoolEmails(new Date(time)); };
const live = (category) => reminders.filter((reminder) => reminder.category === category && reminder.status === "scheduled");

test("December 1 to January 27: every game day and game gets its reminders once, at the right time, including a late-announced time and a rescheduled game", async () => {
  games = [...seeded.map(asGame), ...added.map(([id, kickoff, confirmed]) => asGame({ id, kickoff_at: kickoff, time_confirmed: confirmed }))];
  reminders = [];
  const database = recordingDatabase(respond);
  globalThis.bowlCalendarFixture.database = database;
  const game = (id) => games.find((candidate) => candidate.id === id);

  // The first sweep is the day the Bowl window opens.
  const opening = Date.parse("2026-12-01T05:00:00Z");
  const first = await sweepAt(opening);
  const days = [...new Set(games.map((item) => easternDay(item.kickoff_at)))].sort();
  assert.equal(first.created, days.length + games.filter((item) => item.time_confirmed).length, "a lines email per game day and a pick-due reminder per game with a time");
  assert.equal((await sweepAt(opening)).created, 0, "a second sweep queues nothing");
  assert.equal(live("bowl_pick_due").some((reminder) => reminder.source_game_ids[0] === "san-juan"), false, "a game with no announced time gets no countdown");
  assert.equal(live("bowl_daily_recap").length, 0, "no recap exists before its day");

  // The San Juan Bowl's time arrives on December 14; the Holiday Bowl is rescheduled on December 27 to a day with no other game.
  const announce = Date.parse("2026-12-14T15:00:00Z");
  const reschedule = Date.parse("2026-12-27T15:00:00Z");
  const newKickoff = "2027-01-05T01:00:00.000Z";
  assert.ok(!days.includes(easternDay(newKickoff)), "the new day is one with no other game");
  // The sweep runs through the season twice a day, and in particular the hour before each recap falls due, the moment it does, and the hour after.
  const end = Date.parse("2027-01-27T00:00:00Z");
  const times = new Set([announce, reschedule]);
  for (let time = opening + 12 * HOUR; time <= end; time += 12 * HOUR) times.add(time);
  for (const day of [...days, easternDay(newKickoff)]) for (const offset of [-HOUR, 0, HOUR]) times.add(Date.parse(fiveAmNextDay(day)) + offset);
  for (const time of [...times].filter((candidate) => candidate > opening && candidate <= end).sort((a, b) => a - b)) {
    database.queries.length = 0;
    if (time === announce) {
      Object.assign(game("san-juan"), { kickoff_at: "2026-12-16T22:30:00.000Z", line_lock_at: eightAm("2026-12-16"), time_confirmed: true });
      assert.equal(live("bowl_pick_due").filter((reminder) => reminder.source_game_ids[0] === "san-juan").length, 0);
    }
    if (time === reschedule) {
      Object.assign(game("holiday"), { kickoff_at: newKickoff, line_lock_at: eightAm(easternDay(newKickoff)) });
      await cancelQueuedBowlReminders("holiday");
    }
    await sweepAt(time);
  }

  const finalDays = [...new Set(games.map((item) => easternDay(item.kickoff_at)))].sort();
  const idsOn = (day) => games.filter((item) => easternDay(item.kickoff_at) === day).map((item) => item.id).sort();

  // One lines email per game day, 8 AM Eastern, listing that day's games.
  assert.equal(live("bowl_line_lock").length, finalDays.length);
  for (const day of finalDays) {
    const [email, ...extra] = live("bowl_line_lock").filter((reminder) => reminder.automation_key === `bowl:bowl-26:line-lock:${day}`);
    assert.equal(extra.length, 0);
    assert.equal(email.scheduled_for, eightAm(day), `lines for ${day} go out at 8 AM Eastern`);
    assert.deepEqual([...email.source_game_ids].sort(), idsOn(day));
  }

  // One pick-due reminder per game, 3 hours before its kickoff, each queued before it was due; the moved game's was rebuilt for the new time.
  const timed = games.filter((item) => item.time_confirmed);
  assert.ok(timed.length < games.length, "some games (the playoff rounds) still have no announced time");
  assert.equal(live("bowl_pick_due").length, timed.length, "no countdown for a game whose time is not announced");
  for (const item of timed) {
    const [reminder, ...extra] = live("bowl_pick_due").filter((candidate) => candidate.source_game_ids[0] === item.id);
    assert.equal(extra.length, 0, `${item.id} has one countdown`);
    assert.equal(reminder.scheduled_for, new Date(Date.parse(item.kickoff_at) - 3 * HOUR).toISOString());
    assert.ok(Date.parse(reminder.queuedAt) < Date.parse(reminder.scheduled_for), `${item.id}'s countdown was queued before it was due`);
  }
  const retired = reminders.filter((reminder) => reminder.status === "cancelled");
  assert.ok(retired.length >= 2 && retired.every((reminder) => reminder.source_game_ids.includes("holiday") && reminder.automation_key === null), "only the moved game's old reminders were retired, and they let go of their keys");
  assert.equal(live("bowl_pick_due").find((reminder) => reminder.source_game_ids[0] === "holiday").scheduled_for, "2027-01-04T22:00:00.000Z");

  // One recap per game day, 5 AM Eastern the next morning, queued by the first sweep after it was due and not before.
  assert.equal(live("bowl_daily_recap").length, finalDays.length);
  for (const day of finalDays) {
    const [recap, ...extra] = live("bowl_daily_recap").filter((reminder) => reminder.automation_key === `bowl:bowl-26:daily-recap:${day}`);
    assert.equal(extra.length, 0);
    assert.equal(recap.scheduled_for, fiveAmNextDay(day));
    const lateBy = Date.parse(recap.queuedAt) - Date.parse(recap.scheduled_for);
    assert.ok(lateBy >= 0 && lateBy < HOUR, `${day}'s recap is queued when it falls due, not before (${lateBy / 60000} minutes late)`);
    assert.deepEqual([...recap.source_game_ids].sort(), idsOn(day));
  }

  // The San Juan Bowl's countdown came the hour its time was announced.
  const sanJuan = live("bowl_pick_due").find((reminder) => reminder.source_game_ids[0] === "san-juan");
  assert.equal(sanJuan.scheduled_for, "2026-12-16T19:30:00.000Z");
  assert.equal(sanJuan.queuedAt, new Date(announce).toISOString());
  // The two one-time invitations: "the Bowl Pool is open" the morning of December 7, and one last call 24 hours before the first kickoff, each queued
  // once, when it fell due and while seats could still be claimed.
  const firstGame = [...games].sort((x, y) => Date.parse(x.kickoff_at) - Date.parse(y.kickoff_at))[0];
  for (const [category, key, due] of [["bowl_pool_open", "bowl:bowl-26:open", "2026-12-07T14:00:00.000Z"], ["bowl_pool_last_call", "bowl:bowl-26:last-call", new Date(Date.parse(firstGame.kickoff_at) - 24 * HOUR).toISOString()]]) {
    const [invitation, ...extra] = reminders.filter((reminder) => reminder.category === category);
    assert.equal(extra.length, 0, `${category} is queued once`);
    assert.deepEqual([invitation.automation_key, invitation.scheduled_for, invitation.source_game_ids], [key, due, [firstGame.id]]);
    const lateBy = Date.parse(invitation.queuedAt) - Date.parse(due);
    assert.ok(lateBy >= 0 && lateBy < 12 * HOUR && Date.parse(invitation.queuedAt) < Date.parse(firstGame.kickoff_at), `${category} was queued when it fell due, before the first kickoff`);
  }
  const keys = reminders.map((reminder) => reminder.automation_key).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, "no key was used twice");
});
