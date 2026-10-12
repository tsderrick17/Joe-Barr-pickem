import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { reigningChampionIds } = await import("../src/lib/reigning-champions.ts");
const row = (player_id, pool, season_year) => ({ player_id, pool, season_year });

test("the trophy is held by the latest season's champion, and moves when a new one is crowned", () => {
  assert.deepEqual([...reigningChampionIds([row("john", "survivor", 2025)], "survivor")], ["john"], "before a new champion, the last one holds it");
  assert.deepEqual([...reigningChampionIds([row("john", "survivor", 2025), row("zac", "survivor", 2026)], "survivor")], ["zac"], "John's trophy moves to Zac");
});

test("co-champions of the latest season all hold it, and other pools do not interfere", () => {
  const all = [row("a", "survivor", 2026), row("b", "survivor", 2026), row("c", "survivor", 2025), row("d", "pickem", 2026), row("e", "bowl", 2024)];
  assert.deepEqual([...reigningChampionIds(all, "survivor")].sort(), ["a", "b"]);
  assert.deepEqual([...reigningChampionIds(all, "pickem")], ["d"]);
  assert.deepEqual([...reigningChampionIds([], "survivor")], []);
});
