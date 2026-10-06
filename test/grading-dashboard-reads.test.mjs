import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readGradingGamesAndLines } from "../src/lib/grading-dashboard-reads.js";

test("the dashboard shares one selected-period game read with the lines lookup", async () => {
  const calls = [];
  let finishGames;
  const result = readGradingGamesAndLines(
    () => { calls.push("games"); return new Promise((resolve) => { finishGames = resolve; }); },
    async (ids) => { calls.push(["lines", ids]); return { data: [{ game_id: ids[0], locked_spread: 3 }], error: null }; },
  );
  assert.deepEqual(calls, ["games"]);
  finishGames({ data: [{ id: "game-1", kickoff_at: "2026-10-05T20:00:00Z" }, { id: "game-2", kickoff_at: "2026-10-05T23:00:00Z" }], error: null });
  const [games, lines] = await Promise.all([result.games, result.lines]);
  assert.equal(games.data.length, 2);
  assert.deepEqual(lines.data, [{ game_id: "game-1", locked_spread: 3 }]);
  assert.deepEqual(calls, ["games", ["lines", ["game-1", "game-2"]]]);
});

test("empty or failed game reads keep the line lookup bounded to an empty ID list", async () => {
  for (const gameResult of [{ data: [], error: null }, { data: null, error: { message: "unavailable" } }]) {
    let ids;
    const result = readGradingGamesAndLines(
      async () => gameResult,
      async (gameIds) => { ids = gameIds; return { data: [], error: null }; },
    );
    await Promise.all([result.games, result.lines]);
    assert.deepEqual(ids, []);
  }
});

test("the grading route uses the shared game result instead of another ID query", async () => {
  const source = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  assert.match(source, /const selectedPeriod = readGradingGamesAndLines\(/);
  assert.match(source, /selectedPeriod\.games,[\s\S]*selectedPeriod\.lines,/);
  assert.doesNotMatch(source, /await supabaseAdmin\.from\("games"\)\.select\("id"\)\.eq\("scoring_period_id", period\.id\)/);
});
