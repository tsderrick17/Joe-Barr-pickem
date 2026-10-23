import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// The playoff-day recap and its email copy run for real in playoff-recap-behavior.test.mjs; the three plans' playoff toggles in email-plans.visual.spec.ts; the
// email images (full-width receipts table, the Survivor count under the Survivor table) in the email artwork render and baseline tests.
// What remains are the two reveal snapshots, which are built against a live database and so keep their source rules.
const weeklyRecap = await readFile(new URL("../src/lib/weekly-recap.ts", import.meta.url), "utf8");

test("playoff reveal snapshots are scoped to their scheduled kickoff games", () => {
  assert.match(weeklyRecap, /select\("source_game_ids"\)/);
  assert.match(weeklyRecap, /sourceIds\.has\(game\.id\)/);
  assert.match(weeklyRecap, /selectedPublicGames\.map\(\(game\) => pickByPlayerAndGame/);
  assert.match(weeklyRecap, /NO PICK — LOSS/);
});

test("featured reveal snapshots stay scoped to the scheduled featured game window", () => {
  assert.match(weeklyRecap, /const selectedFeaturedGameIds = new Set/);
  assert.match(weeklyRecap, /selectedFeaturedGameIds\.has\(pick\.game_id\)/);
});
