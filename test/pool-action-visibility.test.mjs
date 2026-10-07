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

test("Pool Action hides malformed kickoff timestamps even when selections exist", () => {
  assert.equal(shouldShowPoolActionMatchup({ kickoffAt: "not-a-date", now, hasSelections: true }), false);
  assert.equal(shouldShowPoolActionMatchup({ kickoffAt: "2026-09-13T20:00:00.000Z", now: "not-a-date", hasSelections: true }), false);
});

test("public reveal images omit players without a revealed selection", () => {
  const selected = { name: "Tyler", wins: 1, picks: ["IND"] };
  assert.deepEqual(onlyPublicPickRows([
    selected,
    { name: "Gary", wins: 2, picks: [] },
    { name: "John", wins: 3 },
    { name: "Rick", wins: 4, picks: null },
    { name: "Ron", wins: 5, picks: "SEA" },
  ]), [selected]);
});

test("every public-pick email image applies the Pool Action row filter", async () => {
  const route = await readFile(new URL("../src/lib/email-artwork.tsx", import.meta.url), "utf8");
  assert.match(route, /onlyPublicPickRows\(safePublicRows\(snapshot.rows\)\)/);
  assert.match(route, /const WIDTH = 760/);
});
