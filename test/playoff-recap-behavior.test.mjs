import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { recordingDatabase } from "./helpers/recording-database.mjs";

// The playoff-day recap, run for real against a scripted database, and the email copy it feeds: which games a recap covers, who is named champion or eliminated.
const SEASON = "season-1";
const PERIODS = [
  { id: "reg", season_id: SEASON, display_name: "Week 18", display_order: 18, period_type: "regular", status: "complete", max_picks: 2 },
  { id: "wc", season_id: SEASON, display_name: "Wild Card", display_order: 19, period_type: "playoff", status: "active", max_picks: 6 },
];
const game = (id, kickoff) => ({ id, scoring_period_id: "wc", kickoff_at: kickoff, status: "final" });
const SAT = game("g-sat", "2027-01-09T18:00:00Z"), SUN = game("g-sun", "2027-01-10T18:00:00Z");
const PLAYERS = [{ id: "zac", first_name: "Zac" }, { id: "gary", first_name: "Gary" }, { id: "tyler", first_name: "Tyler" }];
const pick = (player, game_id, result) => ({ player_id: player, game_id, selected_team_id: `team-${player}`, result });
let games, picks, championships, database;
const respond = (table, calls) => {
  const single = calls.some(([name]) => name === "maybeSingle");
  const filter = (name) => calls.find(([call]) => call === name)?.[1];
  if (table === "scoring_periods") {
    const wanted = filter("eq")?.[0] === "period_type" ? PERIODS.filter((p) => p.period_type === "playoff") : PERIODS;
    return { data: single ? wanted[wanted.length - 1] : PERIODS, error: null };
  }
  if (table === "games") return { data: games, error: null };
  if (table === "picks") return { data: picks, error: null };
  if (table === "players") return { data: PLAYERS, error: null };
  if (table === "pool_championships") return { data: championships, error: null };
  if (table === "teams") return { data: PLAYERS.map((p) => ({ id: `team-${p.id}`, abbreviation: p.first_name.slice(0, 3).toUpperCase() })), error: null };
  throw new Error(`unexpected table ${table}`);
};
globalThis.playoffRecapFixture = { database: null };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase-admin") return { url: "data:text/javascript,export const supabaseAdmin = new Proxy({}, { get: (_, name) => (...args) => globalThis.playoffRecapFixture.database[name](...args) });", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-publishable-key";
const { buildPlayoffDayRecapSnapshot } = await import("../src/lib/weekly-recap.ts");
const { messageHtml } = await import("../src/lib/email-reminders.ts");
const setup = ({ extraGames = [], extraPicks = [], crowned = [] } = {}) => {
  games = [SAT, SUN, ...extraGames];
  picks = [pick("zac", "g-sat", "win"), pick("gary", "g-sat", "loss"), pick("tyler", "g-sat", "win"), pick("zac", "g-sun", "loss"), pick("gary", "g-sun", "win"), ...extraPicks];
  championships = crowned.map((player_id) => ({ player_id }));
  database = recordingDatabase(respond);
  playoffRecapFixture.database = database;
};
const build = async (options, at = "2027-01-11T14:00:00Z") => {
  mock.timers.enable({ apis: ["Date"], now: new Date(at) });
  try { return await buildPlayoffDayRecapSnapshot(options); } finally { mock.timers.reset(); }
};
const day = (snapshot, name) => snapshot.weeklySummary.find((row) => row.name === name);

test("with no scheduled games named, the recap covers the latest played game day", async () => {
  setup();
  const snapshot = await build();
  assert.equal(snapshot.kind, "playoff_day_recap");
  assert.equal(snapshot.week, "Wild Card");
  assert.deepEqual([day(snapshot, "Zac").picks.length, day(snapshot, "Gary").picks.length], [1, 1], "one pick each, from Sunday only");
  assert.equal(day(snapshot, "Gary").wins, 1, "Gary won Sunday");
  assert.equal(day(snapshot, "Zac").wins, 0, "Zac lost Sunday");
});

test("a recap scheduled for particular games covers those games, even if a later day has been played", async () => {
  setup();
  const snapshot = await build({ sourceGameIds: ["g-sat"] });
  assert.equal(day(snapshot, "Zac").wins, 1);
  assert.equal(day(snapshot, "Gary").wins, 0);
  assert.equal(day(snapshot, "Tyler").picks.length, 1, "Tyler picked only Saturday and is in Saturday's recap");
  const sundayOnly = await build({ sourceGameIds: ["g-sun"] });
  assert.equal(day(sundayOnly, "Tyler").picks.length, 0, "and has nothing to show for Sunday");
});

test("a day with a game still unsettled is not recapped yet", async () => {
  setup();
  games = [SAT, { ...SUN, status: "live" }];
  await assert.rejects(build({ sourceGameIds: ["g-sun"] }), /still being finalized/);
  await assert.rejects(build({ sourceGameIds: ["not-a-game"] }), /does not have a scheduled game day/);
});

test("champions are named only on the round's last game day", async () => {
  setup({ crowned: ["gary"] });
  assert.deepEqual((await build({ sourceGameIds: ["g-sat"] })).championsCrowned, [], "Saturday is not the last game day");
  assert.deepEqual((await build({ sourceGameIds: ["g-sun"] })).championsCrowned, ["Gary"]);
  setup({ crowned: ["zac", "gary"] });
  assert.deepEqual((await build({ sourceGameIds: ["g-sun"] })).championsCrowned, ["Gary", "Zac"], "co-champions, alphabetical");
});

const emailFor = (snapshot) => plain(messageHtml({ id: "r1", category: "playoff_day_recap", audience: "all", title: "Wild Card recap", body: "Results are in.", recap_snapshot: snapshot }));
const plain = (html) => html.replaceAll("&#39;", "'");   // the email escapes apostrophes
const base = { kind: "playoff_day_recap", week: "Wild Card", day: "Sunday", standings: [], weeklySummary: [], survivor: { in: 0, out: 0 } };

test("the recap email crowns one champion by name, and shares the title between co-champions", () => {
  assert.match(emailFor({ ...base, eliminatedToday: [], championsCrowned: ["Gary"] }), /Congratulations, Gary — Pick'em Champion!/);
  const shared = emailFor({ ...base, eliminatedToday: [], championsCrowned: ["Gary", "Zac"] });
  assert.match(shared, /Congratulations to our Pick'em co-champions: Gary, Zac!/);
  assert.doesNotMatch(shared, /Pick'em Champion!/);
});

test("the recap email lists who was eliminated that day, and says nothing when no one was", () => {
  assert.match(emailFor({ ...base, eliminatedToday: ["Tyler", "Zac"], championsCrowned: [] }), /Eliminated from Pick'em today: Tyler, Zac\./);
  const quiet = emailFor({ ...base, eliminatedToday: [], championsCrowned: [] });
  assert.doesNotMatch(quiet, /Eliminated from Pick'em|Champion!|co-champions/);
  const weekly = plain(messageHtml({ id: "r2", category: "weekly_recap", audience: "all", title: "Week 5 recap", body: "x", recap_snapshot: { ...base, kind: "weekly_recap", eliminatedToday: ["Zac"], championsCrowned: ["Gary"] } }));
  assert.doesNotMatch(weekly, /Eliminated from Pick'em|Champion!/, "only a playoff-day recap carries these lines");
});
