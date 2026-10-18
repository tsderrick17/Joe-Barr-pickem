import test from "node:test";
import assert from "node:assert/strict";
import { championRoll } from "../src/lib/trophy-roll.js";

const seasons = [
  { seasonYear: 2025, pickem: [{ name: "Steve" }], survivor: [{ name: "John" }], bowl: [{ name: "Al" }] },
  { seasonYear: 2027, pickem: [{ name: "Gary" }, { name: "Rick" }], survivor: null, bowl: [] },
  { seasonYear: 2026, pickem: [{ name: "Tyler" }], survivor: [{ name: "Zac" }], bowl: null },
];

test("the roll is newest first, one line per season, with co-champions joined", () => {
  assert.deepEqual(championRoll(seasons, "pickem"), [
    { year: 2027, names: "Gary & Rick" }, { year: 2026, names: "Tyler" }, { year: 2025, names: "Steve" },
  ]);
});

test("a season where the pool has no champion (none yet, or an empty list) is left out, and the input is not reordered", () => {
  assert.deepEqual(championRoll(seasons, "survivor"), [{ year: 2026, names: "Zac" }, { year: 2025, names: "John" }]);
  assert.deepEqual(championRoll(seasons, "bowl"), [{ year: 2025, names: "Al" }]);
  assert.deepEqual(seasons.map((season) => season.seasonYear), [2025, 2027, 2026]);
});
