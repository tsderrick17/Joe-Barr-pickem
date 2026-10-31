import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";
import { easternDateTimeToUtc } from "../src/lib/schedule-time.js";

// The annual Bowl schedule pull, run for real against an in-memory database that remembers what it is given, with ESPN's real
// postseason list as the provider: December 1 (first pull, teams all TBD), selection day (teams arrive), and a pull that finds nothing new.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const feed = (await read("espn-bowl-schedule-2026-10-31.json")).events;
const seeded = await read("bowl-pool-seeded-2026.json");

const SEASON = { id: "season-1" };
let games; let teams; let lines; let lineRows; let reminderCancels; let gameWrites; let failUpdateFor;
const clone = (value) => JSON.parse(JSON.stringify(value));
const startingGames = () => clone(seeded).map((game) => ({ line_lock_at: game.kickoff_at, is_cfp: /first round|fiesta|cotton|peach|rose|orange|sugar|national/i.test(game.bowl_name), away_team_id: null, home_team_id: null, venue_name: null, venue_city: null, venue_state: null, ...game, provider_game_id: game.provider_game_id }));

const respond = (table, calls) => {
  const names = calls.map(([name]) => name);
  const arg = (method, index = 0) => calls.find(([name]) => name === method)?.[1][index];
  if (table === "bowl_pool_seasons") return { data: SEASON, error: null };
  if (table === "bowl_pool_games") {
    if (names.includes("update")) {
      const id = calls.find(([name, args]) => name === "eq" && args[0] === "id")[1][1];
      const patch = arg("update");
      // The database refuses to change a matchup or kickoff that picks or a locked line hold; other columns are free.
      if (failUpdateFor === id && ("away_team_id" in patch || "kickoff_at" in patch)) return { data: null, error: { code: "P0001" } };
      gameWrites.push({ id, patch: clone(patch) });
      Object.assign(games.find((game) => game.id === id), patch);
      return { data: null, error: null };
    }
    if (names.includes("upsert")) {
      const row = { id: `inserted-${games.length}`, ...clone(arg("upsert")) };
      gameWrites.push({ id: row.id, patch: clone(row) });
      games.push(row);
      return { data: { id: row.id }, error: null };
    }
    return { data: clone(games), error: null };
  }
  if (table === "bowl_pool_teams") {
    if (names.includes("maybeSingle")) {
      const found = teams.find((team) => team.display_name === calls.find(([name]) => name === "eq")[1][1]);
      return { data: found ?? null, error: null };
    }
    if (names.includes("upsert")) {
      const team = { id: `team-${teams.length + 1}`, ...clone(arg("upsert")) };
      teams.push(team);
      return { data: { id: team.id }, error: null };
    }
    return { data: null, error: null };
  }
  if (table === "bowl_pool_game_lines") {
    // The line table behaves as the real one does: an insert that must not replace (ignoreDuplicates) leaves an existing row alone, and an update guarded by
    // `.is("locked_at", null)` touches only a line that has not locked.
    if (names.includes("upsert")) {
      const row = clone(arg("upsert"));
      lines.push({ method: "upsert", row });
      if (!(arg("upsert", 1)?.ignoreDuplicates && lineRows.has(row.game_id))) lineRows.set(row.game_id, row);
    } else {
      const row = clone(arg("update"));
      const gameId = calls.find(([name, args]) => name === "eq" && args[0] === "game_id")[1][1];
      lines.push({ method: "update", row });
      const unlockedOnly = calls.some(([name, args]) => name === "is" && args[0] === "locked_at" && args[1] === null);
      const current = lineRows.get(gameId);
      if (current && (!unlockedOnly || current.locked_at === null)) lineRows.set(gameId, { ...current, ...row });
    }
    return { data: null, error: null };
  }
  if (table === "push_reminders") { reminderCancels.push({ patch: clone(arg("update")), game: arg("contains", 1)[0] }); return { data: null, error: null }; }
  throw new Error(`unexpected table ${table}`);
};
globalThis.bowlSyncFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.bowlSyncFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { syncAnnualSchedule } = await import("../src/lib/sync-bowl-pool.ts");

const realFetch = globalThis.fetch;
const reset = () => { games = startingGames(); teams = []; lines = []; lineRows = new Map(); reminderCancels = []; gameWrites = []; failUpdateFor = null; bowlSyncFixture.database = recordingDatabase(respond); };
const pull = async (events, now = "2026-12-01T12:00:00Z") => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ events }) });
  try { return await syncAnnualSchedule(new Date(now)); } finally { globalThis.fetch = realFetch; }
};
const byName = (name) => games.find((game) => game.bowl_name === name);
const withTeams = (headline, away, home, extra = {}) => feed.map((event) => espnHeadlineOf(event) === headline
  ? { ...event, competitions: [{ ...event.competitions[0], ...extra, competitors: event.competitions[0].competitors.map((competitor, index) => ({ ...competitor, homeAway: index === 0 ? "home" : "away", team: { id: String(100 + index), displayName: index === 0 ? home : away, shortDisplayName: index === 0 ? home : away, abbreviation: "XXX", color: "112233", alternateColor: "ffffff" } })) }] }
  : event);
const espnHeadlineOf = (event) => event.competitions[0].notes[0].headline;

test("December 1: the five missing games are added, the seeded rows keep their names, and nothing is crossed or given a TBD team", async () => {
  reset();
  assert.equal(await pull(feed), 47);
  assert.equal(games.length, 47);
  assert.equal(teams.length, 0, "no TBD team is ever created");
  assert.ok(games.every((game) => !game.away_team_id && !game.home_team_id), "no game has a team a player could pick");
  assert.deepEqual(games.filter((game) => game.id.startsWith("inserted")).map((game) => game.bowl_name).sort(), ["Holiday", "Snoop Dogg Arizona", "Tony the Tiger Sun", "TransPerfect San Juan", "San Diego County Credit Union Poinsettia"].sort());
  assert.equal(byName("Frisco").provider_game_id.startsWith("espn:"), true, "linked to ESPN");
  assert.equal(byName("Cure").bowl_name, "Cure");
  for (const name of ["Frisco", "Frisco Football Classic", "Las Vegas", "Texas", "Liberty", "Music City"]) assert.equal(games.filter((game) => game.bowl_name === name).length, 1, `${name} appears once`);
});

test("December 1: a confirmed time replaces ours, an unconfirmed one never does, and a new game with no time waits at noon marked Time TBD", async () => {
  reset();
  await pull(feed);
  assert.equal(byName("Fiesta").kickoff_at, "2026-12-31T00:30:00.000Z", "the Fiesta quarterfinal's 7:30 PM Eastern, now announced");
  assert.equal(byName("Fiesta").time_confirmed, true);
  for (const name of ["Cotton", "Rose", "Peach"]) {
    assert.equal(byName(name).kickoff_at, "2027-01-01T17:00:00.000Z", `${name} keeps its noon placeholder: ESPN's midnight is not a kickoff`);
    assert.equal(byName(name).time_confirmed, false);
  }
  const sanJuan = games.find((game) => game.bowl_name === "TransPerfect San Juan");
  assert.equal(sanJuan.kickoff_at, "2026-12-16T17:00:00.000Z", "noon Eastern on its day");
  assert.equal(sanJuan.time_confirmed, false);
  assert.equal(new Date(games.find((game) => game.bowl_name === "Sun" || game.bowl_name === "Tony the Tiger Sun").kickoff_at).toISOString(), "2026-12-31T19:00:00.000Z");
  assert.equal(games.find((game) => game.bowl_name === "Tony the Tiger Sun").time_confirmed, true);
  assert.ok(games.every((game) => game.line_lock_at), "every game has a lock time");
});

test("December 1: games take their place by kickoff and a moved game's queued reminders are cancelled and release their key", async () => {
  reset();
  await pull(feed);
  const ordered = [...games].sort((a, b) => a.order_index - b.order_index);
  assert.deepEqual(ordered.map((game) => game.order_index), ordered.map((_, index) => index + 1), "numbered 1 to 47 with no gaps");
  assert.ok(ordered.every((game, index) => index === 0 || Date.parse(game.kickoff_at) >= Date.parse(ordered[index - 1].kickoff_at)), "in kickoff order");
  const moved = reminderCancels.map((cancel) => cancel.game).sort();
  assert.ok(moved.includes(byName("Fiesta").id), "the Fiesta game moved");
  assert.ok(!moved.includes(byName("Cure").id), "a game whose time is unchanged keeps its reminders");
  assert.ok(reminderCancels.every(({ patch }) => patch.status === "cancelled" && patch.automation_key === null), "a cancelled reminder gives up its key so the new time can queue a fresh one");
});

test("a pull that finds nothing new writes nothing", async () => {
  reset();
  await pull(feed);
  gameWrites = []; reminderCancels = []; lines = []; teams = [];
  assert.equal(await pull(feed), 47);
  assert.deepEqual(gameWrites, []);
  assert.deepEqual(reminderCancels, []);
  assert.deepEqual(lines, []);
});

test("selection day: teams and a line arrive for one game, a half-set matchup stays empty, and the kickoff is untouched", async () => {
  reset();
  await pull(feed);
  const before = byName("Cactus").kickoff_at;
  gameWrites = []; reminderCancels = [];
  const events = withTeams("Cactus Bowl", "Arizona State Sun Devils", "Houston Cougars", { odds: [{ spread: -3.5, provider: { name: "Caesars" } }] });
  await pull(events);
  assert.deepEqual(teams.map((team) => team.display_name).sort(), ["Arizona State Sun Devils", "Houston Cougars"]);
  const cactus = byName("Cactus");
  assert.ok(cactus.away_team_id && cactus.home_team_id);
  assert.notEqual(cactus.away_team_id, cactus.home_team_id);
  assert.equal(cactus.kickoff_at, before);
  assert.deepEqual(reminderCancels, [], "teams arriving do not move a reminder");
  assert.equal(lines.filter((line) => line.method === "upsert").length, 1, "the line is saved once, preliminary");
  assert.equal(lines[0].row.game_id, cactus.id);
  assert.equal(lines[0].row.locked_at === null || typeof lines[0].row.locked_at === "string", true);
  // One side still TBD: neither team is set.
  const half = feed.map((event) => espnHeadlineOf(event) === "Alamo Bowl" || espnHeadlineOf(event) === "Valero Alamo Bowl"
    ? { ...event, competitions: [{ ...event.competitions[0], competitors: [{ ...event.competitions[0].competitors[0], team: { id: "7", displayName: "TCU Horned Frogs" } }, event.competitions[0].competitors[1]] }] }
    : event);
  await pull(half);
  assert.equal(byName("Alamo").away_team_id, null);
  assert.equal(byName("Alamo").home_team_id, null);
});

test("a game ESPN reports with a team the database refuses (picks or a locked line already hold the matchup) is logged and the rest still update", async () => {
  reset();
  failUpdateFor = byName("Cure").id;
  const logged = [];
  const realError = console.error;
  console.error = (...args) => logged.push(args);
  try {
    assert.equal(await pull(withTeams("StaffDNA Cure Bowl", "Navy Midshipmen", "Tulane Green Wave")), 46, "the refused game is not counted");
  } finally { console.error = realError; }
  assert.equal(logged.length, 1);
  assert.equal(logged[0][1].gameId, byName("Cure").id);
  assert.equal(byName("Fiesta").time_confirmed, true, "every other game was still brought up to date");
});

test("the Celebration Bowl and the FCS playoff are never imported", async () => {
  reset();
  const fcs = { ...feed[0], id: "fcs-1", competitions: [{ ...feed[0].competitions[0], notes: [{ headline: "FCS Championship - Quarterfinals" }] }] };
  await pull([...feed, fcs]);
  assert.equal(games.length, 47);
  assert.ok(!games.some((game) => /celebration|fcs/i.test(game.bowl_name)));
});

const CACTUS_ODDS = { odds: [{ spread: -3.5, provider: { name: "Caesars" } }] };
const cactusGame = () => byName("Cactus");

test("a line is preliminary (not yet locked) until its game-day morning, then it locks, and a locked official line is never replaced", async () => {
  reset();
  const events = withTeams("Cactus Bowl", "Arizona State Sun Devils", "Houston Cougars", CACTUS_ODDS);
  await pull(events);
  assert.equal(cactusGame().line_lock_at, easternAt(cactusGame().kickoff_at, 8), "8 AM Eastern on game day");
  assert.equal(lineRows.get(cactusGame().id).locked_at, null, "before game day the line is preliminary");
  assert.equal(lineRows.get(cactusGame().id).source_spread, 3.5);
  // The spread moves while it is preliminary: the line follows.
  await pull(withTeams("Cactus Bowl", "Arizona State Sun Devils", "Houston Cougars", { odds: [{ spread: -6.5, provider: { name: "Caesars" } }] }));
  assert.equal(lineRows.get(cactusGame().id).source_spread, 6.5);
  // Game day, after the lock: the line locks.
  await pull(events, "2026-12-26T14:00:00Z");
  const locked = lineRows.get(cactusGame().id);
  assert.ok(locked.locked_at, "locked on game day");
  // A later refresh with a different spread cannot change a locked line.
  await pull(withTeams("Cactus Bowl", "Arizona State Sun Devils", "Houston Cougars", { odds: [{ spread: -10.5, provider: { name: "Caesars" } }] }), "2026-12-26T15:00:00Z");
  assert.equal(lineRows.get(cactusGame().id).source_spread, locked.source_spread);
  assert.equal(lineRows.get(cactusGame().id).locked_at, locked.locked_at);
});

test("a game with no spread from ESPN gets no line", async () => {
  reset();
  await pull(withTeams("Cactus Bowl", "Arizona State Sun Devils", "Houston Cougars"));
  assert.equal(lineRows.size, 0);
});

test("a game linked to ESPN that ESPN has moved by days follows ESPN: one game, new time, reminders for the old time cancelled", async () => {
  reset();
  const espnCactus = feed.find((event) => espnHeadlineOf(event) === "Cactus Bowl");
  Object.assign(cactusGame(), { provider_game_id: `espn:${espnCactus.id}`, kickoff_at: "2026-12-22T00:30:00.000Z" });
  await pull(feed);
  assert.equal(games.length, 47, "not added a second time");
  assert.equal(cactusGame().kickoff_at, new Date(espnCactus.date).toISOString());
  assert.ok(reminderCancels.some((cancel) => cancel.game === cactusGame().id));
});

test("the database's own timestamp format does not read as a change", async () => {
  reset();
  await pull(feed);
  for (const game of games) { game.kickoff_at = new Date(game.kickoff_at).toISOString().replace(".000Z", "+00:00"); game.line_lock_at = new Date(game.line_lock_at).toISOString().replace(".000Z", "+00:00"); }
  gameWrites = []; reminderCancels = [];
  await pull(feed);
  assert.deepEqual(gameWrites, []);
  assert.deepEqual(reminderCancels, []);
});

test("a game ESPN has dropped is left as it is, with its picks", async () => {
  reset();
  const without = feed.filter((event) => espnHeadlineOf(event) !== "Cactus Bowl");
  await pull(without);
  assert.ok(cactusGame(), "the row stays");
  assert.equal(games.length, 47, "nothing is deleted");
});

function easternAt(iso, hour) {
  const day = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [year, month, date] = day.split("-").map(Number);
  return easternDateTimeToUtc(year, month, date, hour).toISOString();
}
