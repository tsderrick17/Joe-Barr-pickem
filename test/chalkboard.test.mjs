import assert from "node:assert/strict";
import test from "node:test";
import { bowlChartReady, bowlSnapshot } from "../src/lib/chalkboard.js";

test("the Bowl Pool's chart shows up once the first 10 bowls are final", () => {
  const games = (finals) => ({ games: Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, status: i < finals ? "final" : i === finals ? "cancelled" : "scheduled" })) });
  assert.equal(bowlChartReady(games(9)), false);
  assert.equal(bowlChartReady(games(10)), true);
  assert.equal(bowlChartReady(null), false);
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
