import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { officiallyOutEntryIds } = await import("../src/lib/survivor-official.ts");
const entry = (id, status, period = null) => ({ id, status, eliminated_scoring_period_id: period });
const pick = (id, period, result) => ({ survivor_entry_id: id, scoring_period_id: period, result });

test("a lost entry is not officially out until someone else wins that week", () => {
  const entries = [entry("a", "active"), entry("b", "eliminated", "w5"), entry("c", "eliminated", "w5")];
  // Everyone lost in week 5: nobody else won, so b and c are not out (co-champions are decided once the week settles).
  assert.deepEqual([...officiallyOutEntryIds(entries, [pick("b", "w5", "loss"), pick("c", "w5", "loss"), pick("a", "w5", "loss")])], []);
  // a wins in week 5: b and c are now officially out.
  assert.deepEqual([...officiallyOutEntryIds(entries, [pick("b", "w5", "loss"), pick("c", "w5", "loss"), pick("a", "w5", "win")])].sort(), ["b", "c"]);
});

test("only a win in the same week counts, and never the entry's own", () => {
  const entries = [entry("a", "active"), entry("b", "eliminated", "w4")];
  assert.deepEqual([...officiallyOutEntryIds(entries, [pick("a", "w5", "win"), pick("b", "w4", "loss")])], [], "a win in a later week does not make an earlier loss official");
  assert.deepEqual([...officiallyOutEntryIds(entries, [pick("a", "w4", "win")])], ["b"]);
});

test("active entries are never out, and an elimination with no recorded week is out", () => {
  assert.deepEqual([...officiallyOutEntryIds([entry("a", "active"), entry("z", "eliminated", null)], [])], ["z"]);
});
