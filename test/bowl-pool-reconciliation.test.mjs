import test from "node:test";
import assert from "node:assert/strict";
import { assessBowlPoolSettlement } from "../src/lib/bowl-pool-reconciliation.js";

const base = { games: [{ id: "g1", status: "final" }], entries: [{ id: "e1", status: "active" }], lines: [{ game_id: "g1" }] };
test("Bowl settlement accepts matching graded pick and receipt", () => {
  const result = assessBowlPoolSettlement({ ...base, picks: [{ entry_id: "e1", game_id: "g1", result: "win" }], results: [{ entry_id: "e1", game_id: "g1", result: "win" }] });
  assert.equal(result.healthy, true);
});
test("Bowl settlement catches missing and mismatched receipts", () => {
  const result = assessBowlPoolSettlement({ ...base, picks: [{ entry_id: "e1", game_id: "g1", result: "pending" }], results: [] });
  assert.equal(result.healthy, false);
  assert.match(result.problems.join(" "), /missing a result/);
  assert.match(result.problems.join(" "), /still pending/);
});
