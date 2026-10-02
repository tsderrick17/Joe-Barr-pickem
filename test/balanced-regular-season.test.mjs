import assert from "node:assert/strict";
import test from "node:test";
import { regularSeasonTeamPairs } from "./fixtures/balanced-regular-season.mjs";

test("the chaos rehearsal fixture gives all 32 teams exactly 17 games", () => {
  const appearances = Array(32).fill(0);
  const survivorTeams = new Set();
  let games = 0;
  for (let week = 0; week < 18; week += 1) {
    const pairs = regularSeasonTeamPairs(week);
    assert.equal(pairs.length, week < 2 ? 16 : 15);
    const teamsThisWeek = pairs.flat();
    assert.equal(new Set(teamsThisWeek).size, teamsThisWeek.length);
    for (const team of teamsThisWeek) appearances[team] += 1;
    const survivorChoice = pairs.slice(2).find(([away]) => !survivorTeams.has(away));
    assert.ok(survivorChoice, `week ${week + 1} needs a fresh Survivor team`);
    survivorTeams.add(survivorChoice[0]);
    games += pairs.length;
  }
  assert.equal(games, 272);
  assert.deepEqual(appearances, Array(32).fill(17));
});
