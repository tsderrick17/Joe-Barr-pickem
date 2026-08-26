import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onlyPublicPickRows, shouldShowPoolActionMatchup } from "../src/lib/pool-action-visibility.js";

const now = "2026-09-13T18:00:00.000Z";

test("Pool Action keeps future games and selected started games", () => {
  assert.equal(shouldShowPoolActionMatchup({ kickoffAt: "2026-09-13T20:00:00.000Z", now, hasSelections: false }), true);
  assert.equal(shouldShowPoolActionMatchup({ kickoffAt: "2026-09-13T17:00:00.000Z", now, hasSelections: true }), true);
  assert.equal(shouldShowPoolActionMatchup({ kickoffAt: "2026-09-13T17:00:00.000Z", now, hasSelections: false }), false);
});

test("public reveal images omit players without a revealed selection", () => {
  assert.deepEqual(onlyPublicPickRows([
    { name: "Tyler", wins: 1, picks: ["IND"] },
    { name: "Gary", wins: 2, picks: [] },
  ]), [{ name: "Tyler", wins: 1, picks: ["IND"] }]);
});

test("every public-pick email image applies the Pool Action row filter", async () => {
  const route = await readFile(new URL("../src/app/api/recap-image/route.tsx", import.meta.url), "utf8");
  assert.equal(route.match(/rows=\{onlyPublicPickRows\(snapshot\.rows\)\}/g)?.length, 3);
});
