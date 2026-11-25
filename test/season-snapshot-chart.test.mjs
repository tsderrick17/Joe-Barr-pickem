import assert from "node:assert/strict";
import test from "node:test";
import { roundedEdge, snapshotRibbonPath } from "../src/lib/season-snapshot-chart.js";

// Each cubic segment as [x0,y0, c1x,c1y, c2x,c2y, x1,y1].
function segments(path) {
  const numbers = path.match(/-?\d+(\.\d+)?/g).map(Number);
  const out = [];
  for (let i = 2; i + 5 < numbers.length; i += 6) out.push([numbers[i - 2], numbers[i - 1], ...numbers.slice(i, i + 6)]);
  return out;
}

test("rounded bends pass through every week's point and never go past the totals on either side", () => {
  const pairs = [[0, 50], [40, 30], [80, 30], [120, 10], [160, 40]];
  const path = roundedEdge(pairs, "M");
  assert.match(path, /^M0,50 C/);
  const segs = segments(path);
  assert.equal(segs.length, pairs.length - 1);
  segs.forEach(([x0, y0, , c1y, , c2y, x1, y1], index) => {
    assert.deepEqual([x0, y0], pairs[index]);
    assert.deepEqual([x1, y1], pairs[index + 1]);
    const [low, high] = [Math.min(y0, y1), Math.max(y0, y1)];
    for (const c of [c1y, c2y]) assert.ok(c >= low - 1e-9 && c <= high + 1e-9, `control ${c} stays between ${low} and ${high}`);
  });
});

test("a flat stretch stays flat, and the straight ribbon is unchanged unless rounding is asked for", () => {
  const segs = segments(roundedEdge([[0, 20], [40, 20], [80, 20]], "M"));
  segs.forEach((seg) => assert.ok([seg[1], seg[3], seg[5], seg[7]].every((y) => y === 20)));
  const points = [{ x: 0, top: 50, bottom: 54 }, { x: 40, top: 30, bottom: 34 }];
  assert.equal(snapshotRibbonPath(points), "M0,50 L40,30 L40,34 L0,54 Z");
  assert.match(snapshotRibbonPath([...points, { x: 80, top: 10, bottom: 14 }], 0, 1, true), /^M0,50 C.* L80,14 C.* Z$/);
});

import { SNAPSHOT_ALL_UP_TO, snapshotPreset } from "../src/lib/season-snapshot-chart.js";

test("the Season Snapshot's quick choices: Top 5, you and the top five, everyone, nobody", () => {
  const ranked = Array.from({ length: 20 }, (_, index) => `p${index}`);
  assert.deepEqual([...snapshotPreset("top5", ranked, "p12")], ["p0", "p1", "p2", "p3", "p4"]);
  assert.deepEqual([...snapshotPreset("me-top5", ranked, "p12")], ["p0", "p1", "p2", "p3", "p4", "p12"]);
  assert.equal(snapshotPreset("me-top5", ranked, "p3").size, 5, "already in the top five: still five lines");
  assert.equal(snapshotPreset("me-top5", ranked, "someone-else").size, 5, "a viewer not in the pool adds nobody");
  assert.equal(snapshotPreset("all", ranked, null).size, 20);
  assert.equal(snapshotPreset("none", ranked, null).size, 0);
  assert.equal(SNAPSHOT_ALL_UP_TO, 8, "a pool of eight (today's) still opens with everyone on the chart");
});
