import assert from "node:assert/strict";
import test from "node:test";
import { parseNflverseRegularSeason } from "../src/lib/full-schedule-provider.js";

const teams = ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LV","LAC","LAR","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS"];

function completeSchedule() {
  const rows = ["game_id,season,game_type,week,gameday,gametime,away_team,home_team"];
  for (let week = 1; week <= 18; week += 1) {
    const date = new Date(Date.UTC(2026, 8, 13 + ((week - 1) * 7))).toISOString().slice(0, 10);
    const gameCount = week <= 2 ? 16 : 15;
    for (let game = 0; game < gameCount; game += 1) {
      const away = teams[game];
      const home = teams[31 - game];
      rows.push(`2026_${String(week).padStart(2, "0")}_${away}_${home},2026,REG,${week},${date},13:00,${away},${home}`);
    }
  }
  return rows.join("\n");
}

test("full-season provider accepts only a complete 272-game regular season", () => {
  const games = parseNflverseRegularSeason(completeSchedule(), 2026);
  assert.equal(games.length, 272);
  assert.deepEqual(new Set(games.map((game) => game.week)), new Set(Array.from({ length: 18 }, (_, index) => index + 1)));
  assert.ok(games.every((game) => game.lineLockAt < game.kickoffAt));
});

test("full-season provider fails closed when even one game is missing", () => {
  const rows = completeSchedule().split("\n");
  assert.throws(() => parseNflverseRegularSeason(rows.slice(0, -1).join("\n"), 2026), /271.*expected 272/);
});
