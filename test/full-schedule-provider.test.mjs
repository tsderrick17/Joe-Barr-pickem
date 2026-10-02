import assert from "node:assert/strict";
import test from "node:test";
import { parseNflverseRegularSeason } from "../src/lib/full-schedule-provider.js";

const teams = ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LV","LAC","LAR","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA","SF","TB","TEN","WAS"];

/**
 * A realistic schedule: every team plays the same number of games with one bye.
 * 18 weeks gives 17 games each (272); 19 weeks gives 18 games each (288).
 */
function completeSchedule(weekCount = 18) {
  const rows = ["game_id,season,game_type,week,gameday,gametime,away_team,home_team"];
  const fullWeeks = weekCount - 16; // the other 16 weeks each give two teams a bye
  for (let week = 1; week <= weekCount; week += 1) {
    const date = new Date(Date.UTC(2026, 8, 13 + ((week - 1) * 7))).toISOString().slice(0, 10);
    const byeIndex = week - fullWeeks - 1;
    const playing = byeIndex >= 0 ? teams.filter((_, index) => Math.floor(index / 2) !== byeIndex) : teams;
    for (let game = 0; game < playing.length / 2; game += 1) {
      const away = playing[game];
      const home = playing[playing.length - 1 - game];
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
  assert.throws(() => parseNflverseRegularSeason(rows.slice(0, -1).join("\n"), 2026), /271.*expected at least 272/);
});

test("live reconciliation tolerates a rescheduled game crossing the pool-week date boundary", () => {
  const csv = completeSchedule().replace(",2026,REG,1,2026-09-13,13:00,ARI,WAS", ",2026,REG,1,2026-09-15,13:00,ARI,WAS");
  assert.throws(() => parseNflverseRegularSeason(csv, 2026), /spans multiple pool gameweeks/);
  const games = parseNflverseRegularSeason(csv, 2026, { allowWeekGameweekDrift: true });
  assert.equal(games.length, 272);
  assert.equal(games.find((game) => game.providerEventId.includes("ARI_WAS"))?.week, 1);
});

test("a longer season (18 games over 19 weeks) is read from the feed", async () => {
  const { regularSeasonShape } = await import("../src/lib/full-schedule-provider.js");
  const games = parseNflverseRegularSeason(completeSchedule(19), 2026);
  assert.equal(games.length, 288);
  assert.deepEqual(regularSeasonShape(games), { weeks: 19, teams: 32, gamesPerTeam: 18 });
});

test("a feed where teams play different numbers of games is not a complete season", () => {
  // Drop one week-3 game: two teams now play 16 games while everyone else plays 17.
  const rows = completeSchedule().split("\n");
  const week3 = rows.findIndex((row) => row.includes(",REG,3,"));
  const unbalanced = [...rows.slice(0, week3), ...rows.slice(week3 + 1)];
  // Add a duplicate-free extra game elsewhere so the total is still 272.
  unbalanced.push("2026_18_EXTRA,2026,REG,18,2027-01-10,13:00,ARI,BAL");
  assert.throws(() => parseNflverseRegularSeason(unbalanced.join("\n"), 2026), /does not describe a complete season/);
});
