import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { activeSurvivor, concludedSurvivor, shapeSlateGames, unavailableSurvivor } = await import("../src/lib/slate-shape.ts");

// Fictional rows shaped like the database's. `now` is 1:30 PM Eastern on a Sunday, so the
// 1:00 PM games have kicked off and the 4:25 PM and Monday games have not.
const NOW = new Date("2026-10-04T17:30:00Z");
const teams = [
  ["ind", "Indianapolis Colts", "IND"], ["was", "Washington Commanders", "WAS"],
  ["lar", "Los Angeles Rams", "LAR"], ["phi", "Philadelphia Eagles", "PHI"],
  ["gb", "Green Bay Packers", "GB"], ["tb", "Tampa Bay Buccaneers", "TB"],
].map(([id, full_name, abbreviation]) => ({ id, full_name, abbreviation }));
const game = (id, away, home, kickoff, extra = {}) => ({ id, away_team_id: away, home_team_id: home, kickoff_at: kickoff, line_lock_at: "2026-10-04T12:00:00Z", is_international: false, status: "scheduled", away_score: null, home_score: null, ...extra });
const games = [
  game("g1", "was", "ind", "2026-10-04T17:00:00Z", { status: "final", away_score: 19, home_score: 24 }),
  game("g2", "phi", "lar", "2026-10-04T17:00:00Z", { status: "live" }),
  game("g3", "tb", "gb", "2026-10-04T20:25:00Z"),
];
const players = [{ id: "p1", first_name: "Dana" }, { id: "p2", first_name: "Sam" }, { id: "p3", first_name: "Chris" }];
const lockedLines = [
  { game_id: "g1", favorite_team_id: "ind", locked_spread: "3.5", source: "odds", locked_at: "2026-10-04T12:00:00Z" },
  { game_id: "g2", favorite_team_id: "lar", locked_spread: 3, source: "odds", locked_at: "2026-10-04T12:00:00Z" },
];
const history = [
  { game_id: "g3", favorite_team_id: "gb", spread: "-2.5", captured_at: "2026-10-03T00:00:00Z" },
  { game_id: "g3", favorite_team_id: "tb", spread: "-1", captured_at: "2026-09-30T00:00:00Z" },
];
// The route only fetches picks for started games; the unstarted g3 row below stands in for a bug that lets one through.
const publicPicks = [
  { player_id: "p1", game_id: "g1", selected_team_id: "ind" },
  { player_id: "p2", game_id: "g1", selected_team_id: "ind" },
  { player_id: "p3", game_id: "g1", selected_team_id: "was" },
  { player_id: "p1", game_id: "g2", selected_team_id: "phi" },
  { player_id: "p2", game_id: "g3", selected_team_id: "gb" },
];
const shape = (overrides = {}) => shapeSlateGames({ games, teams, history, lockedLines, publicPicks, players, now: NOW, ...overrides });

test("pickers are named only for games that have kicked off, even if an unstarted game's picks slip into the input", () => {
  const [g1, g2, g3] = shape();
  assert.deepEqual([g1.homePickers, g1.awayPickers], [["Dana", "Sam"], ["Chris"]]);
  assert.deepEqual([g2.awayPickers, g2.homePickers], [["Dana"], []]);
  assert.deepEqual([g3.awayPickers, g3.homePickers], [[], []]);
  // A pick on a game that starts one second from now stays private.
  const justBefore = shape({ now: new Date("2026-10-04T20:24:59Z") });
  assert.deepEqual(justBefore[2].homePickers, []);
  // And becomes public at the kickoff instant.
  const atKickoff = shape({ now: new Date("2026-10-04T20:25:00Z") });
  assert.deepEqual(atKickoff[2].homePickers, ["Sam"]);
});

test("a player who is not in the active roster is never named", () => {
  const [g1] = shape({ players: [{ id: "p1", first_name: "Dana" }] });
  assert.deepEqual(g1.homePickers, ["Dana"]);
  assert.deepEqual(g1.awayPickers, []);
});

test("official lines beat preliminary ones, and the latest preliminary line is used before a lock", () => {
  const [g1, , g3] = shape();
  assert.deepEqual([g1.officialSpread, g1.preliminarySpread, g1.favoriteTeamId, g1.spreadSource], [3.5, null, "ind", "odds"]);
  assert.deepEqual([g3.officialSpread, g3.preliminarySpread, g3.favoriteTeamId, g3.spreadSource, g3.spreadLockedAt], [null, -2.5, "gb", null, null]);
});

test("only a final game with an official line carries against-the-spread results", () => {
  const [g1, g2] = shape();
  // Indianapolis (favorite, -3.5) won by 5: the favorite covers, Washington does not.
  assert.deepEqual([g1.homeResult, g1.awayResult], ["win", "loss"]);
  assert.deepEqual([g2.homeResult, g2.awayResult], [null, null]);
  const noLine = shape({ lockedLines: [] })[0];
  assert.deepEqual([noLine.homeResult, noLine.awayResult, noLine.officialSpread], [null, null, null]);
});

test("unknown teams fall back to safe labels and the full response shape is stable", () => {
  const [g1] = shape({ teams: [] });
  assert.deepEqual([g1.awayTeam, g1.homeTeam, g1.awayTeamAbbreviation, g1.homeTeamAbbreviation], ["Unknown team", "Unknown team", "NFL", "NFL"]);
  assert.deepEqual(Object.keys(shape()[0]), [
    "id", "kickoffAt", "lineLockAt", "isInternational", "awayTeam", "homeTeam", "awayTeamAbbreviation", "homeTeamAbbreviation",
    "favoriteTeamId", "awayTeamId", "homeTeamId", "officialSpread", "preliminarySpread", "spreadSource", "spreadLockedAt",
    "status", "awayScore", "homeScore", "awayResult", "homeResult", "awayPickers", "homePickers",
  ]);
});

test("Survivor state: unavailable, concluded for the playoffs, and an active entry", () => {
  assert.deepEqual(unavailableSurvivor(true), { available: false, chipsVisible: true, notice: "Survivor is temporarily unavailable. ATS picks remain available.", status: "active", requiredThisPeriod: false, showOnReceipt: false, pick: null, usedTeamIds: [] });
  assert.deepEqual(concludedSurvivor(), { available: false, chipsVisible: false, notice: "Survivor has concluded for the season.", status: "complete", requiredThisPeriod: false, showOnReceipt: false, pick: null, usedTeamIds: [] });
  const base = { pick: { game_id: "g1", selected_team_id: "ind" }, usedPicks: [{ selected_team_id: "lar" }, { selected_team_id: "gb" }], scoringPeriodId: "w5", periodType: "regular", periodFirstKickoffAt: "2026-10-01T00:20:00Z", chipsVisible: true, season: { survivor_champion_player_id: null, survivor_champion_crowned_at: null } };
  const active = activeSurvivor({ ...base, entry: { status: "active", eliminated_scoring_period_id: null } });
  assert.deepEqual([active.available, active.requiredThisPeriod, active.status, active.usedTeamIds, active.pick.selected_team_id, active.notice], [true, true, "active", ["lar", "gb"], "ind", null]);
  // Eliminated earlier: not required this week. Eliminated this week: still shown for the week.
  assert.equal(activeSurvivor({ ...base, entry: { status: "eliminated", eliminated_scoring_period_id: "w2" } }).requiredThisPeriod, false);
  assert.equal(activeSurvivor({ ...base, entry: { status: "eliminated", eliminated_scoring_period_id: "w5" } }).requiredThisPeriod, true);
  // Once a champion exists the status reads complete for everyone.
  const crowned = activeSurvivor({ ...base, entry: { status: "active", eliminated_scoring_period_id: null }, season: { survivor_champion_player_id: "p1", survivor_champion_crowned_at: "2026-10-04T00:00:00Z" } });
  assert.equal(crowned.status, "complete");
});
