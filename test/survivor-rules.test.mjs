import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowSurvivorSlateChips } from "../src/lib/survivor-chip-visibility.js";
import { readFile } from "node:fs/promises";
import { championNames } from "../src/lib/champion-names.js";
import { gradeSurvivorPick } from "../src/lib/survivor-grading.js";

// The survivor rules that each needed only a test or two, kept together. Each block is one rule's tests, named for the file it came from.

// survivor-chip-visibility
{
  test("removes Survivor chips immediately when a champion is crowned", () => {
    assert.equal(shouldShowSurvivorSlateChips({
      periodType: "regular",
      championCrownedAt: "2026-12-22T03:30:00Z", // Dec. 21 ET
      now: "2026-12-22T04:59:59Z", // still Dec. 21 ET
    }), false);
  });

  test("keeps Survivor chips retired after the championship day", () => {
    assert.equal(shouldShowSurvivorSlateChips({
      periodType: "regular",
      championCrownedAt: "2026-12-22T03:30:00Z", // Dec. 21 ET
      now: "2026-12-22T05:00:00Z", // Dec. 22 ET
    }), false);
  });

  test("never exposes Survivor chips in the playoffs", () => {
    assert.equal(shouldShowSurvivorSlateChips({
      periodType: "playoff",
      championCrownedAt: null,
      now: "2027-01-10T12:00:00Z",
    }), false);
  });
}

// survivor-co-champions
{
  test("co-champions read as one title", () => {
    assert.equal(championNames([]), null);
    assert.equal(championNames(["Ann"]), "Ann");
    assert.equal(championNames(["Ann", "Bob"]), "Ann & Bob");
    assert.equal(championNames(["Ann", "Bob", "Cal"]), "Ann, Bob & Cal");
    assert.equal(championNames(["Ann", undefined, "Cal"]), "Ann & Cal");
  });

  test("Survivor always ends with a champion, decided only once the deciding week settles", async () => {
    const sql = await readFile(new URL("../supabase/migrations/20261002010000_survivor_co_champions.sql", import.meta.url), "utf8");
    assert.match(sql, /drop index if exists public\.pool_championships_one_survivor_per_year_key;/);
    // Last one standing: only after the deciding week completes or the survivor's own pick wins.
    assert.match(sql, /if active_count = 1 and deciding_period\.id is not null then[\s\S]*?deciding_period\.status <> 'complete' and not exists \([\s\S]*?pick\.result = 'win'/);
    // Same-week finish: everyone eliminated in the deciding week shares it, once that week is complete.
    assert.match(sql, /elsif active_count = 0 and deciding_period\.id is not null then[\s\S]*?eliminated_scoring_period_id = deciding_period\.id/);
    // Several survivors: shared once every regular-season week is complete.
    assert.match(sql, /elsif active_count >= 2 and regular_season_done then/);
    // One row per champion; the season keeps its single "decided" marker.
    assert.match(sql, /insert into public\.pool_championships \(season_id, season_year, pool, player_id, crowned_at\)[\s\S]*?from unnest\(champion_ids\)/);
    assert.match(sql, /set survivor_champion_player_id = champion_ids\[1\]/);
    assert.match(sql, /create trigger crown_survivor_champion_after_period_complete/);
    assert.match(sql, /create trigger crown_survivor_champion_after_pick_graded/);
  });

  test("every place that names the Survivor champion names all co-champions", async () => {
    for (const file of ["src/app/api/home/route.ts", "src/app/api/survivor/route.ts", "src/lib/weekly-recap.ts"]) {
      const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
      assert.match(source, /championNames\(/, file);
      assert.match(source, /pool === "survivor"|\.eq\("pool", "survivor"\)/, file);
    }
  });
}

// survivor-grading
{
  const game = {
    awayTeamId: "away",
    homeTeamId: "home",
    awayScore: 24,
    homeScore: 20,
  };

  test("grades a straight-up Survivor winner and loser", () => {
    assert.equal(gradeSurvivorPick({ ...game, selectedTeamId: "away" }), "win");
    assert.equal(gradeSurvivorPick({ ...game, selectedTeamId: "home" }), "loss");
  });

  test("records a Survivor tie as a loss", () => {
    assert.equal(
      gradeSurvivorPick({ ...game, selectedTeamId: "away", awayScore: 21, homeScore: 21 }),
      "loss",
    );
  });
}
