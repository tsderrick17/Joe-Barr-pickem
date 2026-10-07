import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { shapePadRows, signedSpread } = await import("../src/lib/home-shape.ts");

// Fictional rows. `now` is 1:30 PM Eastern on a Sunday: g1 and g2 (1:00 PM) have kicked off, g3 (4:25 PM) has not.
const NOW = new Date("2026-10-04T17:30:00Z");
const players = [{ id: "p1", first_name: "Dana" }, { id: "p2", first_name: "Sam" }, { id: "p3", first_name: "Chris" }];
const gameById = new Map([["g1", { id: "g1", kickoff_at: "2026-10-04T17:00:00Z" }], ["g2", { id: "g2", kickoff_at: "2026-10-04T17:00:00Z" }], ["g3", { id: "g3", kickoff_at: "2026-10-04T20:25:00Z" }]]);
const teamById = new Map([["ind", { name: "Indianapolis Colts", abbreviation: "IND" }], ["was", { name: "Washington Commanders", abbreviation: "WAS" }], ["gb", { name: "Green Bay Packers", abbreviation: "GB" }]]);
const pick = (player, game, team, result = "pending", period = "w5") => ({ player_id: player, game_id: game, selected_team_id: team, scoring_period_id: period, submitted_at: "2026-10-01T00:00:00Z", result });
const week = [pick("p1", "g3", "gb"), pick("p1", "g1", "ind", "win"), pick("p2", "g1", "was", "loss"), pick("p2", "g3", "gb"), pick("p3", "g2", "ind")];
const lockedLineByGameId = new Map([["g1", { game_id: "g1", favorite_team_id: "ind", locked_spread: "3.5" }]]);
const preliminaryLineByGameId = new Map([["g3", { game_id: "g3", favorite_team_id: "gb", spread: 2, captured_at: "2026-10-03T00:00:00Z" }]]);
const shape = (overrides = {}) => shapePadRows({ players, allPicks: week, currentWeekPicks: week, gameById, teamById, lockedLineByGameId, preliminaryLineByGameId, trophiesByPlayerId: new Map([["p1", ["Pick'em Champion 2025"]]]), playoffEliminatedPlayerIds: new Set(["p3"]), viewerPlayerId: "p1", now: NOW, ...overrides });
const rowFor = (rows, name) => rows.find((row) => row.firstName === name);

test("a player's own pick is always visible to them; everyone else's only after kickoff", () => {
  const rows = shape();
  // Dana (the viewer) sees her unstarted Green Bay pick; Sam's unstarted pick is hidden from Dana.
  const dana = rowFor(rows, "Dana").picks;
  assert.deepEqual(dana.map((item) => [item.abbreviation, item.isHidden]), [["IND", false], ["GB", false]]);
  const sam = rowFor(rows, "Sam").picks;
  assert.deepEqual(sam.map((item) => item.isHidden), [false, true]);
  // The hidden pick leaks nothing: no team, no abbreviation, no spread, no result.
  const hidden = sam[1];
  assert.deepEqual([hidden.label, hidden.abbreviation, hidden.spread, hidden.resultMark], [null, null, null, ""]);
  // Seen from Sam's seat the same row flips: Sam sees his own, and Dana's unstarted pick is hidden.
  const fromSam = shape({ viewerPlayerId: "p2" });
  assert.deepEqual(rowFor(fromSam, "Dana").picks.map((item) => item.isHidden), [false, true]);
  assert.deepEqual(rowFor(fromSam, "Sam").picks.map((item) => item.isHidden), [false, false]);
});

test("a pick becomes public at the kickoff instant and not a second before", () => {
  const before = rowFor(shape({ now: new Date("2026-10-04T20:24:59Z") }), "Sam").picks[1];
  const at = rowFor(shape({ now: new Date("2026-10-04T20:25:00Z") }), "Sam").picks[1];
  assert.equal(before.isHidden, true);
  assert.deepEqual([at.isHidden, at.abbreviation, at.spread], [false, "GB", "-2"]);
});

test("picks keep their column in kickoff order, whatever order they were made in", () => {
  const dana = rowFor(shape(), "Dana").picks;
  assert.deepEqual(dana.map((item) => item.kickoffAt), ["2026-10-04T17:00:00Z", "2026-10-04T20:25:00Z"]);
});

test("rows are sorted by wins, then name, and carry trophies and elimination", () => {
  const rows = shape();
  assert.deepEqual(rows.map((row) => [row.firstName, row.wins]), [["Dana", 1], ["Chris", 0], ["Sam", 0]]);
  assert.deepEqual(rowFor(rows, "Dana").trophies, ["Pick'em Champion 2025"]);
  assert.deepEqual([rowFor(rows, "Chris").playoffEliminated, rowFor(rows, "Dana").playoffEliminated], [true, false]);
});

test("large season histories count only wins and keep the visible slate picks grouped by player", () => {
  const rows = shape({
    allPicks: [
      ...week,
      ...Array.from({ length: 90 }, (_, index) => pick(
        index % 3 === 0 ? "p1" : index % 3 === 1 ? "p2" : "p3",
        `history-${index}`,
        "ind",
        index % 4 === 0 ? "win" : index % 4 === 1 ? "void" : "pending",
        `history-week-${Math.floor(index / 6)}`,
      )),
    ],
    currentWeekPicks: week,
  });

  assert.deepEqual(rows.map((row) => [row.id, row.wins]), [["p1", 9], ["p2", 8], ["p3", 7]]);
  assert.deepEqual(rows.map((row) => [row.id, row.picks.length]), [["p1", 2], ["p2", 2], ["p3", 1]]);
});

test("results, spreads and line-lock flags follow the line on record", () => {
  const [ind] = rowFor(shape(), "Dana").picks;
  assert.deepEqual([ind.resultMark, ind.spread, ind.isLineLocked], ["W", "-3.5", true]);
  const [was] = rowFor(shape(), "Sam").picks;
  assert.deepEqual([was.resultMark, was.spread], ["L", "+3.5"]);
  // Before a lock the preliminary line is shown and the pick is not marked locked.
  const gb = rowFor(shape(), "Dana").picks[1];
  assert.deepEqual([gb.spread, gb.isLineLocked], ["-2", false]);
});

test("spreads are signed from the picked team's side", () => {
  assert.equal(signedSpread("ind", "ind", 3), "-3");
  assert.equal(signedSpread("was", "ind", 3), "+3");
  assert.equal(signedSpread("ind", "ind", "11.5"), "-11.5");
  assert.equal(signedSpread("ind", "ind", 0), "PK");
  assert.equal(signedSpread("ind", null, 7), "+7");
  assert.equal(signedSpread("ind", "ind", "not a number"), null);
});
