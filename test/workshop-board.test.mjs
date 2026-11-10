import assert from "node:assert/strict";
import test from "node:test";
import { mergeSaved, shelfProblems, WORKSHOP_SHELVES } from "../src/lib/workshop-board.js";

const PIECES = ["chip", "submit", "highlight", "pennant", "tile", "wins", "football", "stamp", "crest", "season-over", "eliminated", "pull", "banner-pickem", "banner-bowl", "banner-survivor"];

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

test("every piece is on exactly one shelf", () => {
  assert.deepEqual(shelfProblems(WORKSHOP_SHELVES, PIECES), []);
  assert.deepEqual(shelfProblems([{ title: "x", pieces: [{ id: "chip" }, { id: "chip" }, { id: "nope" }] }], ["chip", "stamp"]), ["stamp is on no shelf", "chip is on more than one shelf", "nope is not a piece"]);
});
