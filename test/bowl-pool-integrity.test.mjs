import test from "node:test";
import assert from "node:assert/strict";
import { assessBowlPoolIntegrity } from "../src/lib/bowl-pool-integrity.js";

const games = [
  { id: "a", kickoff_at: "2026-12-15T17:30:00Z", order_index: 1, status: "scheduled", away_team_id: "away-a", home_team_id: "home-a" },
  { id: "b", kickoff_at: "2026-12-15T21:00:00Z", order_index: 2, status: "scheduled", away_team_id: "away-b", home_team_id: "home-b" },
];

test("Bowl Pool integrity accepts ordered scheduled games with teams and lines", () => {
  const result = assessBowlPoolIntegrity(games, [{ game_id: "a" }, { game_id: "b" }], new Date("2026-12-01T00:00:00Z"));
  assert.equal(result.healthy, true);
  assert.deepEqual(result.problems, []);
});

test("Bowl Pool integrity catches missing teams, duplicate order, and overdue lines", () => {
  const result = assessBowlPoolIntegrity([
    games[1],
    { ...games[0], home_team_id: null, order_index: 2 },
  ], [], new Date("2026-12-16T00:00:00Z"));
  assert.equal(result.healthy, false);
  assert.equal(result.missingLines, 2);
  assert.match(result.problems.join(" "), /missing a team/);
  assert.match(result.problems.join(" "), /Duplicate Bowl Pool order index/);
  assert.match(result.problems.join(" "), /missing a locked line/);
});

test("Bowl Pool integrity allows a postponed game without requiring a line", () => {
  const result = assessBowlPoolIntegrity([{ ...games[0], status: "postponed" }], [], new Date("2026-12-16T00:00:00Z"));
  assert.equal(result.healthy, true);
});
