import assert from "node:assert/strict";
import test from "node:test";
import { bowlSnapshot, chalkPages, chalkSketch } from "../src/lib/chalkboard.js";

const players = [{ id: "a", firstName: "Ann" }, { id: "b", firstName: "Bo" }];
const week = (n, a, b) => ({ id: `w${n}`, label: `Week ${n}`, complete: true, scores: [{ playerId: "a", wins: a }, { playerId: "b", wins: b }] });

test("the chalk sketch shows the last six points with a run-up, scaled to the box, and names the leader", () => {
  const weeks = Array.from({ length: 9 }, (_, i) => week(i + 1, (i + 1) * 2, (i + 1) * 2 - (i > 6 ? 1 : 0)));
  const sketch = chalkSketch(weeks, players, { w: 100, h: 50 });
  assert.equal(sketch.from, "Week 4");
  assert.equal(sketch.to, "Week 9");
  assert.equal(sketch.lines[0].points.length, 7);                  // week 3 as the run-up, then weeks 4-9
  assert.deepEqual(sketch.lines[0].points[0], [0, 50]);            // the fewest wins in view sit on the floor
  assert.deepEqual(sketch.lines[0].points.at(-1), [100, 0]);       // the most on the ceiling
  assert.deepEqual(sketch.leaders.map((line) => line.name), ["Ann"]);
  assert.equal(chalkSketch([], players, { w: 1, h: 1 }), null);
});

test("the board's pages: the regular season, the playoffs once a day is final, the Bowl Pool in bowl season, and notes before there is a chart", () => {
  const colors = new Map([["a", "#2a78d6"]]);
  const regular = [week(1, 1, 1), week(2, 3, 2)];
  const [season] = chalkPages({ pickem: { regular, playoffs: [] }, players, colors });
  assert.equal(season.title, "SEASON SNAPSHOT");
  assert.equal(season.span, "WEEKS 1–2");
  assert.equal(season.leader, "ANN LEADS · 3");
  assert.equal(season.lines[0].color, "#2a78d6");
  assert.equal(season.lines[1].color, "#f4f1e8");                  // a player with no color yet draws in plain chalk

  const playoffs = [{ id: "p1", label: "Wild Card", day: "Sat", scores: [{ playerId: "a", wins: 4 }, { playerId: "b", wins: 4 }] }, { id: "p2", label: "Wild Card", day: "Sun", scores: [] }];
  const [playoff] = chalkPages({ pickem: { regular, playoffs }, players, colors });
  assert.equal(playoff.title, "PLAYOFFS");
  assert.equal(playoff.leader, "2 TIED AT 4");

  assert.equal(chalkPages({ pickem: null, players, colors, hidden: true })[0].note, "Opens after Week 6");
  const withBowl = chalkPages({ pickem: { regular, playoffs: [] }, players, colors, bowl: { weeks: [], players } });
  assert.deepEqual(withBowl.map((page) => page.title), ["SEASON SNAPSHOT", "BOWL POOL"]);
  assert.equal(withBowl[1].note, "After the first bowl day");
});

test("the Bowl Pool's chart moves a day at a time: a day counts once every bowl on it is decided, and a missed pick's automatic result counts", () => {
  const game = (id, kickoff, status) => ({ id, kickoff_at: kickoff, status });
  const payload = {
    standings: [{ playerId: "a", playerName: "Ann", wins: 2 }, { playerId: "b", playerName: "Bo", wins: 1 }],
    games: [
      game("g1", "2026-12-20T17:00:00Z", "final"),
      game("g2", "2026-12-21T01:00:00Z", "final"),           // 8 PM Eastern on the 20th: the same bowl day
      game("g3", "2026-12-22T19:00:00Z", "cancelled"),       // a day of only a called-off bowl adds no point
      game("g4", "2026-12-23T19:00:00Z", "final"),
      game("g5", "2026-12-23T23:00:00Z", "scheduled"),       // the 23rd is still being played: it waits
      game("g6", "2026-12-26T19:00:00Z", "final"),
    ],
    publicPicks: [
      { game_id: "g1", playerId: "a", result: "win" }, { game_id: "g1", playerId: "b", result: "loss" },
      { game_id: "g2", playerId: "a", result: "win" },
      { game_id: "g4", playerId: "a", result: "win" },
    ],
    automaticResults: [{ game_id: "g2", playerId: "b", result: "win" }, { game_id: "g1", playerId: "a", result: "loss" }],
  };
  const { weeks, players: shown } = bowlSnapshot(payload);
  assert.deepEqual(shown.map((player) => player.firstName), ["Ann", "Bo"]);
  assert.deepEqual(weeks.map((day) => day.label), ["Dec 20"]);
  assert.deepEqual(weeks[0].scores, [{ playerId: "a", wins: 2 }, { playerId: "b", wins: 1 }]);
});
