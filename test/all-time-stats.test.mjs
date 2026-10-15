import test from "node:test";
import assert from "node:assert/strict";
import { BEST_SEASON_MIN_AB, QUALIFYING_AB, buildAllTimeStats, formatAverage } from "../src/lib/all-time-stats.js";

const players = [{ id: "ann", first_name: "Ann" }, { id: "bob", first_name: "Bob" }, { id: "cy", first_name: "Cy" }];
const seasons = [{ id: "s25", year: 2025 }, { id: "s26", year: 2026 }];
const periods = [
  { id: "p25", season_id: "s25", display_order: 1, period_type: "regular" },
  { id: "p26", season_id: "s26", display_order: 1, period_type: "regular" },
  { id: "w4", season_id: "s26", display_order: 4, period_type: "regular" },
  { id: "w9", season_id: "s26", display_order: 9, period_type: "regular" },
  { id: "wild", season_id: "s26", display_order: 19, period_type: "playoff" },
];

/** n games, one per day from a start date, with a given favorite on every game ("fav"). */
const makeGames = (count, prefix = "g", start = Date.parse("2026-09-01T17:00:00Z")) =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}`, kickoff_at: new Date(start + index * 86_400_000).toISOString() }));
const lines = (games) => games.map((game) => ({ game_id: game.id, favorite_team_id: "fav" }));
const pick = (player_id, game, result, selected_team_id = "fav", scoring_period_id = "p26") =>
  ({ id: `${player_id}-${game.id}`, player_id, game_id: game.id, scoring_period_id, selected_team_id, result });

test("a batting average is covers over graded picks, shown like a baseball average", () => {
  assert.equal(formatAverage(0.571), ".571");
  assert.equal(formatAverage(1), "1.000");
  assert.equal(formatAverage(0.5), ".500");
  assert.equal(formatAverage(null), "—");
  const games = makeGames(4);
  const picks = [pick("ann", games[0], "win"), pick("ann", games[1], "win"), pick("ann", games[2], "loss"), pick("ann", games[3], "win")];
  const { players: rows } = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks });
  assert.equal(rows[0].ab, 4);
  assert.equal(rows[0].h, 3);
  assert.equal(rows[0].avg, 0.75);
});

test("pending and voided picks never count, and a push is a loss", () => {
  const games = makeGames(4);
  const picks = [pick("ann", games[0], "win"), pick("ann", games[1], "pending"), pick("ann", games[2], "void"), pick("ann", games[3], "loss")];
  const row = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks }).players[0];
  assert.equal(row.ab, 2, "only the win and the loss are graded");
  assert.equal(row.avg, 0.5);
});

test("slugging counts an underdog cover as a double and a favorite cover as a single", () => {
  const games = makeGames(3);
  const picks = [pick("ann", games[0], "win", "fav"), pick("ann", games[1], "win", "dog"), pick("ann", games[2], "loss", "dog")];
  const row = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks }).players[0];
  assert.equal(row.slg, (1 + 2) / 3);
});

test("the longest hit streak follows kickoff order across seasons and resets on a loss", () => {
  const early = makeGames(3, "a", Date.parse("2025-09-07T17:00:00Z"));
  const late = makeGames(4, "b", Date.parse("2026-09-06T17:00:00Z"));
  const games = [...early, ...late];
  const picks = [
    pick("ann", early[0], "win", "fav", "p25"), pick("ann", early[1], "win", "fav", "p25"), pick("ann", early[2], "loss", "fav", "p25"),
    pick("ann", late[0], "win"), pick("ann", late[1], "win"), pick("ann", late[2], "win"), pick("ann", late[3], "loss"),
  ];
  // Insert out of order on purpose: the order the picks arrive in must not matter.
  const row = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks: [...picks].reverse() }).players[0];
  assert.equal(row.longestStreak, 3);
  assert.equal(row.seasons, 2);
});

test("best season ignores seasons with too few picks, and qualification needs enough at bats", () => {
  const games = makeGames(BEST_SEASON_MIN_AB + 3);
  const hot = games.slice(0, 3);
  // Bob goes 3 for 3 in 2025 (too few picks to count) and 10 for 20 in 2026.
  const picks = [
    ...hot.map((game) => pick("bob", game, "win", "fav", "p25")),
    ...games.slice(3, 3 + BEST_SEASON_MIN_AB).map((game, index) => pick("bob", game, index % 2 ? "loss" : "win")),
  ];
  const row = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks }).players[0];
  assert.equal(row.bestSeason.year, 2026);
  assert.equal(row.bestSeason.avg, 0.5);
  assert.equal(row.qualified, false, `under ${QUALIFYING_AB} at bats`);
});

test("qualified players rank above the rest, by average then hits; the rest by at bats", () => {
  const games = makeGames(QUALIFYING_AB + 10);
  const picks = [];
  games.slice(0, QUALIFYING_AB).forEach((game, index) => {
    picks.push(pick("ann", game, index < 30 ? "win" : "loss"));      // .600 on 50
    picks.push(pick("bob", game, index < 35 ? "win" : "loss"));      // .700 on 50
  });
  games.slice(0, 5).forEach((game) => picks.push(pick("cy", game, "win"))); // 1.000 on 5: not qualified, ranks last
  const names = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks }).players.map((row) => row.name);
  assert.deepEqual(names, ["Bob", "Ann", "Cy"]);
});

test("the trophy room lists seasons newest first with co-champions kept and a missing crown left empty", () => {
  const result = buildAllTimeStats({
    players, seasons, periods, games: [], lines: [], picks: [],
    championships: [
      { season_year: 2025, pool: "pickem", player_id: "ann" }, { season_year: 2025, pool: "survivor", player_id: "bob" },
      { season_year: 2026, pool: "pickem", player_id: "ann" }, { season_year: 2026, pool: "pickem", player_id: "cy" },
    ],
    bowlChampionships: [{ season_year: 2026, player_id: "bob" }],
  });
  assert.deepEqual(result.trophies.map((row) => row.seasonYear), [2026, 2025]);
  assert.deepEqual(result.trophies[0].pickem.map((entry) => entry.name), ["Ann", "Cy"]);
  assert.equal(result.trophies[0].survivor, null, "no Survivor champion crowned yet in 2026");
  assert.deepEqual(result.trophies[0].bowl.map((entry) => entry.name), ["Bob"]);
  const ann = result.players.find((row) => row.name === "Ann");
  assert.deepEqual(ann.titles, { pickem: 2, survivor: 0 });
  assert.equal(result.players.find((row) => row.name === "Cy").titles.pickem, 1);
  assert.equal(ann.ab, 0, "a champion with no pick history on file still has a row");
  assert.equal(ann.avg, null);
});

test("the Bowl Pool is not part of the batting table: a Bowl-only champion has no row and no title count", () => {
  const result = buildAllTimeStats({ players, seasons, periods, games: [], lines: [], picks: [], bowlChampionships: [{ season_year: 2026, player_id: "bob" }] });
  assert.equal(result.players.length, 0, "a Bowl champion with no Pick'em or Survivor history is not a batter");
  assert.deepEqual(result.trophies[0].bowl.map((entry) => entry.name), ["Bob"], "but the season plaque still names the Bowl champion");
});

test("Survivor exit is the average regular-season week of each elimination, ignoring seasons still alive and playoff periods", () => {
  const survivorEntries = [
    { player_id: "ann", eliminated_scoring_period_id: "w4" },
    { player_id: "ann", eliminated_scoring_period_id: "w9" },
    { player_id: "ann", eliminated_scoring_period_id: null },    // a season she won or is still alive in: not an exit
    { player_id: "bob", eliminated_scoring_period_id: "wild" },  // not a regular week: ignored
  ];
  const games = makeGames(1);
  const picks = [pick("ann", games[0], "win"), pick("bob", games[0], "loss")];
  const rows = buildAllTimeStats({ players, seasons, periods, games, lines: lines(games), picks, survivorEntries }).players;
  const ann = rows.find((row) => row.name === "Ann");
  assert.deepEqual(ann.survivorExit, { averageWeek: 6.5, exits: 2 });
  assert.equal(rows.find((row) => row.name === "Bob").survivorExit, null);
});
