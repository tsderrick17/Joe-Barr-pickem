import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Slate loads do not wait on pool-wide maintenance or unpublished picks", async () => {
  const route = await readFile(
    new URL("../src/app/api/board/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /after\(\(\) => recordPlayerActivity\(player\.id\)\)/);
  assert.doesNotMatch(route, /await voidDisruptedPicks\(\)/);
  assert.doesNotMatch(route, /await eliminateSurvivorNoPicks\(\)/);
  assert.match(route, /const startedGameIds = \(games as GameRow\[\]\)/);
  assert.match(route, /\.in\("game_id", startedGameIds\)/);
  assert.match(route, /if \(period\.period_type !== "playoff"\)/);
});
