import test from "node:test";
import assert from "node:assert/strict";
import { buildGroupStats } from "../src/lib/group-stats.js";

const players = [{ id: "ann", first_name: "Ann" }, { id: "bob", first_name: "Bob" }];
const seasons = [{ id: "s25", year: 2025 }, { id: "s26", year: 2026 }];
const week = (season, order, status = "complete", type = "regular", max = 2) => ({ id: `${season}-w${order}`, season_id: season, display_order: order, period_type: type, status, max_picks: max });
const periods = [week("s25", 1), week("s25", 2), week("s25", 3), week("s26", 1), week("s26", 2), week("s26", 3, "active"), week("s26", 20, "complete", "playoff", 6)];

// two games every week, "fav" is a 3-point favorite at home against "dog"
let n = 0;
const games = [], lines = [], picks = [];
const game = (periodId, score = [27, 20], extra = {}) => {
  const id = `g${n++}`;
  games.push({ id, home_team_id: "fav", away_team_id: "dog", home_score: score[0], away_score: score[1], is_neutral_site: false, ...extra });
  lines.push({ game_id: id, favorite_team_id: "fav", locked_spread: 3 });
  return id;
};
const pick = (player, periodId, gameId, team, result) => picks.push({ id: `p${n++}`, player_id: player, game_id: gameId, scoring_period_id: periodId, selected_team_id: team, result });

// 2025: Ann sweeps w1, goes 1-1 in w2, sweeps w3. Bob: donut w1, then picks only one game in w2 (wins it = 1-1), sweeps w3
for (const [order, annResults, bobResults] of [[1, ["win", "win"], ["loss", "loss"]], [2, ["win", "loss"], ["win"]], [3, ["win", "win"], ["win", "win"]]]) {
  const periodId = `s25-w${order}`;
  const g1 = game(periodId), g2 = game(periodId);
  annResults.forEach((result, i) => pick("ann", periodId, i ? g2 : g1, result === "win" ? "fav" : "dog", result));
  bobResults.forEach((result, i) => pick("bob", periodId, i ? g2 : g1, result === "win" ? "fav" : "dog", result));
}
// 2026: w1 Ann sweeps again (her streak carries from 2025), Bob sweeps; w2 Ann has a voided pick (left out), Bob is 1-1; w3 is still active (not counted)
{
  const g1 = game("s26-w1"), g2 = game("s26-w1");
  pick("ann", "s26-w1", g1, "fav", "win"); pick("ann", "s26-w1", g2, "fav", "win"); pick("bob", "s26-w1", g1, "fav", "win"); pick("bob", "s26-w1", g2, "fav", "win");
  const h1 = game("s26-w2"), h2 = game("s26-w2");
  pick("ann", "s26-w2", h1, "fav", "void"); pick("ann", "s26-w2", h2, "fav", "win"); pick("bob", "s26-w2", h1, "fav", "win"); pick("bob", "s26-w2", h2, "dog", "loss");
  const a1 = game("s26-w3"); pick("ann", "s26-w3", a1, "fav", "pending");
}
const stats = buildGroupStats({ players, seasons, periods, games, lines, picks });

test("weekly records: a missed pick is a loss, a voided week is left out, unfinished weeks are not counted", () => {
  // Ann: 2-0, 1-1, 2-0, 2-0, (void week skipped). Bob: 0-2, 1-1 (one pick made), 2-0, 2-0, 1-1.
  assert.deepEqual(stats.weeks, { total: 9, donut: 1, split: 3, sweep: 5 });
});

test("a streak carries from one season into the next, and a skipped week neither breaks nor extends it", () => {
  const ann = stats.streaks.sweeps.find((row) => row.name === "Ann"), bob = stats.streaks.sweeps.find((row) => row.name === "Bob");
  assert.equal(ann.longest, 2, "2025 w3 and 2026 w1 are consecutive counted weeks for Ann");
  assert.equal(ann.current, 2, "her void week is skipped, so the run is still alive");
  assert.deepEqual(ann.endedAt, { seasonYear: 2026, week: 1 });
  assert.equal(bob.longest, 2); assert.equal(bob.current, 0, "Bob's last counted week was 1-1");
  const dryAnn = stats.streaks.noDonut.find((row) => row.name === "Ann"), dryBob = stats.streaks.noDonut.find((row) => row.name === "Bob");
  assert.equal(dryAnn.longest, 4); assert.equal(dryAnn.current, 4);
  assert.equal(dryBob.longest, 4, "Bob went 4 weeks without a donut after his week-1 donut"); assert.equal(dryBob.current, 4);
  assert.deepEqual(stats.streaks.sweeps.map((row) => row.name), ["Ann", "Bob"], "ordered by longest run");
});

test("the group record counts every graded pick, and the splits add up", () => {
  assert.equal(stats.record.wins + stats.record.losses, stats.graded);
  assert.equal(stats.record.wins, 14); assert.equal(stats.record.losses, 4);
  const { favorite, underdog } = stats.splits.side;
  assert.equal(favorite.picks + underdog.picks, stats.graded);
  assert.equal(underdog.picks, 4); assert.equal(underdog.wins, 0, "a 7-point home win is a cover for the favorite only");
  assert.ok(Math.abs(favorite.share + underdog.share - 1) < 1e-9);
  assert.equal(stats.splits.venue.home.picks + stats.splits.venue.away.picks + stats.splits.venue.neutral.picks, stats.graded);
  assert.deepEqual(stats.bySeason.map((season) => season.seasonYear), [2026, 2025]);
});

test("a pick that lands exactly on the number is a push, graded as a loss, and tallied", () => {
  const g = "push-game";
  const withPush = buildGroupStats({
    players, seasons, periods,
    games: [{ id: g, home_team_id: "fav", away_team_id: "dog", home_score: 23, away_score: 20, is_neutral_site: true }],
    lines: [{ game_id: g, favorite_team_id: "fav", locked_spread: 3 }],
    picks: [{ id: "x", player_id: "ann", game_id: g, scoring_period_id: "s25-w1", selected_team_id: "fav", result: "loss" }],
  });
  assert.equal(withPush.record.pushes, 1); assert.equal(withPush.record.pushedGames, 1); assert.equal(withPush.record.pushShare, 1);
  assert.equal(withPush.record.losses, 1);
  assert.equal(withPush.splits.venue.neutral.picks, 1, "neutral-site games are their own row");
});

test("no data gives empty, safe numbers", () => {
  const empty = buildGroupStats({ players: [], seasons: [], periods: [], games: [], lines: [], picks: [] });
  assert.equal(empty.record.hitRate, null); assert.equal(empty.weeks.total, 0); assert.deepEqual(empty.streaks.sweeps, []);
});

test("each player gets their own full set, and the players add up to the group", () => {
  assert.deepEqual(stats.players.map((player) => player.name), ["Ann", "Bob"], "sorted by name");
  const [ann, bob] = stats.players;
  assert.equal(ann.record.wins + bob.record.wins, stats.record.wins);
  assert.equal(ann.record.losses + bob.record.losses, stats.record.losses);
  assert.deepEqual(ann.weeks, { total: 4, donut: 0, split: 1, sweep: 3 });
  assert.deepEqual(bob.weeks, { total: 5, donut: 1, split: 2, sweep: 2 });
  assert.equal(ann.weeks.total + bob.weeks.total, stats.weeks.total);
  assert.deepEqual(ann.streaks.sweeps, { longest: 2, current: 2, endedAt: { seasonYear: 2026, week: 1 } });
  assert.deepEqual(bob.streaks.noDonut, { longest: 4, current: 4, endedAt: { seasonYear: 2026, week: 2 } });
  assert.equal(ann.splits.side.favorite.picks + ann.splits.side.underdog.picks, ann.graded);
  assert.deepEqual(ann.bySeason.map((season) => season.seasonYear), [2026, 2025]);
});

test("a player with no graded pick and no completed week is left out, and a former player keeps a name", () => {
  const out = buildGroupStats({
    players: [{ id: "ann", first_name: "Ann" }], seasons, periods,
    games: [{ id: "x", home_team_id: "fav", away_team_id: "dog", home_score: 27, away_score: 20, is_neutral_site: false }],
    lines: [{ game_id: "x", favorite_team_id: "fav", locked_spread: 3 }],
    picks: [
      { id: "1", player_id: "ann", game_id: "x", scoring_period_id: "s26-w3", selected_team_id: "fav", result: "pending" },
      { id: "2", player_id: "gone", game_id: "x", scoring_period_id: "s26-w1", selected_team_id: "fav", result: "win" },
    ],
  });
  assert.deepEqual(out.players.map((player) => player.name), ["Former player"], "Ann only has a pending pick");
});
