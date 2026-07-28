import assert from "node:assert/strict";
import test from "node:test";
import { reconcileFinalScores } from "../src/lib/final-score-reconciliation.js";

const storedFinal = { externalGameId: "game-1", awayScore: 24, homeScore: 17 };

test("marks matching provider finals as reconciled", () => {
  const [result] = reconcileFinalScores({ storedFinals: [storedFinal], providerEvents: [{ id: "game-1", completed: true, awayScore: 24, homeScore: 17 }] });
  assert.equal(result.state, "match");
});

test("flags score differences without changing stored results", () => {
  const [result] = reconcileFinalScores({ storedFinals: [storedFinal], providerEvents: [{ id: "game-1", completed: true, awayScore: 23, homeScore: 17 }] });
  assert.equal(result.state, "mismatch");
  assert.equal(result.awayScore, 24);
});

test("reports missing or not-final provider events distinctly", () => {
  const results = reconcileFinalScores({ storedFinals: [storedFinal, { ...storedFinal, externalGameId: "game-2" }], providerEvents: [{ id: "game-1", completed: false, awayScore: null, homeScore: null }] });
  assert.deepEqual(results.map((result) => result.state), ["provider_not_final", "not_reported"]);
});
