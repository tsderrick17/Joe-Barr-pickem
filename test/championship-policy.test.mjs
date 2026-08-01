import assert from "node:assert/strict";
import test from "node:test";
import { resolvePickemChampions } from "../src/lib/championship-policy.js";

test("a completed Pick'em season crowns every tied leader", () => {
  assert.deepEqual(resolvePickemChampions([
    { playerId: "al", periodStatus: "complete", result: "win" },
    { playerId: "tyler", periodStatus: "complete", result: "win" },
    { playerId: "al", periodStatus: "complete", result: "loss" },
    { playerId: "tyler", periodStatus: "complete", result: "loss" },
  ]), ["al", "tyler"]);
});

test("a season with an incomplete period cannot crown anyone", () => {
  assert.deepEqual(resolvePickemChampions([
    { playerId: "al", periodStatus: "complete", result: "win" },
    { playerId: "tyler", periodStatus: "active", result: "pending" },
  ]), []);
});

test("voided disrupted-game picks never decide a title", () => {
  assert.deepEqual(resolvePickemChampions([
    { playerId: "al", periodStatus: "complete", result: "win" },
    { playerId: "tyler", periodStatus: "complete", result: "win" },
    { playerId: "al", periodStatus: "complete", result: "void" },
  ]), ["al", "tyler"]);
});
