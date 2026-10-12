import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { padRankLabels } = await import("../src/lib/pad-rank.ts");
const labels = (wins) => Object.fromEntries([...padRankLabels(wins.map((w, i) => ({ id: `p${i}`, wins: w }))).entries()]);

test("ranks follow total wins, with a T on every tied rank and the next rank skipping the tie", () => {
  assert.deepEqual(labels([7, 3, 3, 1]), { p0: "1", p1: "T2", p2: "T2", p3: "4" });
  assert.deepEqual(labels([5, 5, 5]), { p0: "T1", p1: "T1", p2: "T1" });
  assert.deepEqual(labels([9]), { p0: "1" });
});

test("a player shown alone still gets the rank they hold in the whole pool", () => {
  const all = padRankLabels([{ id: "gary", wins: 7 }, { id: "ann", wins: 7 }, { id: "john", wins: 3 }, { id: "zed", wins: 0 }]);
  assert.equal(all.get("john"), "3", "John is third in the pool even if only Gary and John are in the email");
  assert.equal(all.get("gary"), "T1");
});
