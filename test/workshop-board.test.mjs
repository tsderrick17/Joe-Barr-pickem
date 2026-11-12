import assert from "node:assert/strict";
import test from "node:test";
import { gridArea, layoutPlaces, layoutProblems, mergeSaved, nextInRipple, WORKSHOP_LAYOUTS, WORKSHOP_ORDER, WORKSHOP_RIPPLE, WORKSHOP_STILL } from "../src/lib/workshop-board.js";

const PIECES = ["chip", "submit", "highlight", "pennant", "tile", "football", "stamp", "crest", "eliminated", "pull", "banner"];

test("saved settings are used only where they still fit, so an old or damaged save never breaks the board", () => {
  const defaults = { knobs: { pace: 140, "--tilt": 45 }, chip: { team: "KC", spinning: false }, words: "Chiefs" };
  const rules = { limits: { "knobs.pace": [40, 400] }, choices: { "chip.team": ["KC", "BUF"] } };
  assert.deepEqual(mergeSaved(defaults, { knobs: { pace: 200, "--tilt": 30 }, chip: { team: "BUF", spinning: true }, words: "Rams" }, rules), { knobs: { pace: 200, "--tilt": 30 }, chip: { team: "BUF", spinning: true }, words: "Rams" });
  assert.deepEqual(mergeSaved(defaults, { knobs: { pace: 9000, "--tilt": "steep" }, chip: { team: "XYZ", spinning: "yes" }, words: 4, extra: 1 }, rules), defaults);
  assert.deepEqual(mergeSaved(defaults, { knobs: { pace: Number.NaN } }, rules).knobs.pace, 140);
  assert.deepEqual(mergeSaved(defaults, null, rules), defaults);
  assert.deepEqual(mergeSaved(defaults, [1, 2], rules), defaults);
  assert.deepEqual(mergeSaved(defaults, { chip: "KC" }, rules).chip, defaults.chip);
});

test("every layout holds every piece once, each in one rectangle, with no gaps", () => {
  for (const [name, rows] of Object.entries(WORKSHOP_LAYOUTS)) assert.deepEqual(layoutProblems(rows, PIECES), [], name);
  assert.deepEqual(WORKSHOP_LAYOUTS.phone[0].length, 2);
  assert.deepEqual(WORKSHOP_LAYOUTS.tablet[0].length, 4);
  assert.deepEqual(WORKSHOP_LAYOUTS.desktop[0].length, 6);
  assert.deepEqual([...WORKSHOP_ORDER].sort(), [...PIECES].sort());
});

test("a broken layout is caught: a ragged row, a missing piece, an unknown one, and a piece split in two", () => {
  assert.deepEqual(layoutProblems([["chip", "chip"], ["stamp"]], ["chip", "stamp"]), ["row 2 is 1 wide, not 2"]);
  assert.deepEqual(layoutProblems([["chip", "nope"]], ["chip", "stamp"]), ["stamp is not on the board", "nope is not a piece"]);
  assert.deepEqual(layoutProblems([["chip", "stamp", "chip"]], ["chip", "stamp"]), ["chip is not one rectangle"]);
  assert.deepEqual(layoutProblems([["chip", "stamp"], ["stamp", "chip"]], ["chip", "stamp"]), ["chip is not one rectangle", "stamp is not one rectangle"]);
});

test("the ripple takes every piece with a moment in reading order, and skips any that cannot play now", () => {
  assert.deepEqual(WORKSHOP_RIPPLE, WORKSHOP_ORDER.filter((id) => !WORKSHOP_STILL.includes(id)));
  assert.equal(WORKSHOP_RIPPLE.length, 9);
  const order = ["a", "b", "c", "d"];
  assert.equal(nextInRipple(order, -1, () => true), 0);
  assert.equal(nextInRipple(order, 3, () => true), 0);   // round again from the top
  assert.equal(nextInRipple(order, 0, (id) => id === "d"), 3);   // pieces off screen are skipped
  assert.equal(nextInRipple(order, 2, (id) => id === "a"), 0);
  assert.equal(nextInRipple(order, 1, () => false), -1);   // nothing on screen: nothing plays
});

test("a piece's place becomes its grid area", () => {
  const places = layoutPlaces([["a", "a", "b"], ["a", "a", "c"]]);
  assert.deepEqual(places.a, { row: 1, column: 1, rows: 2, columns: 2 });
  assert.equal(gridArea(places.a), "1 / 1 / 3 / 3");
  assert.equal(gridArea(places.c), "2 / 3 / 3 / 4");
});
