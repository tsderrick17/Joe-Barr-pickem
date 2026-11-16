import test from "node:test";
import assert from "node:assert/strict";
import { weeksThrough, winTotals } from "../src/lib/board-totals.js";

test("a player's total is every pick graded a win; a loss, a push or a pick still to play adds nothing", () => {
  const picks = [
    { player_id: "a", result: "win" }, { player_id: "a", result: "win" }, { player_id: "a", result: "loss" },
    { player_id: "b", result: "win" }, { player_id: "b", result: null }, { player_id: "c", result: "void" },
  ];
  assert.deepEqual(winTotals(picks), { a: 2, b: 1 });
  assert.deepEqual(winTotals([]), {});
});

test("a snapshot of a week counts the regular season's weeks up to and including it, and no playoff round", () => {
  const periods = [
    { id: "w1", display_order: 1, period_type: "regular" }, { id: "w2", display_order: 2, period_type: "regular" },
    { id: "w3", display_order: 3, period_type: "regular" }, { id: "p1", display_order: 19, period_type: "playoff" },
  ];
  assert.deepEqual(weeksThrough(periods[1], periods), ["w1", "w2"]);
  assert.deepEqual(weeksThrough(periods[0], periods), ["w1"]);
  assert.deepEqual(weeksThrough(periods[2], periods), ["w1", "w2", "w3"]);
});
