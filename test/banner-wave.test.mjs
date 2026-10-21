import assert from "node:assert/strict";
import test from "node:test";
import { clothSheen, clothShift } from "../src/lib/banner-wave.js";

test("the cloth is pinned at the rod and swings freely toward the hem", () => {
  let nearRod = 0, nearHem = 0;
  for (let t = 0; t < 40; t += 0.05) {
    nearRod = Math.max(nearRod, Math.abs(clothShift(0, t)));
    nearHem = Math.max(nearHem, Math.abs(clothShift(1, t)));
  }
  assert.ok(nearRod < 0.5, `almost nothing at the rod (${nearRod.toFixed(2)})`);
  assert.ok(nearHem > 5 && nearHem < 10, `a few units at the hem (${nearHem.toFixed(2)})`);
});

test("neighbouring rows move almost together, so edges and lettering bend smoothly instead of stepping", () => {
  const rows = 320;   // the slices down a banner about 250 units tall, drawn two device pixels at a time at about 2.5 pixels to the unit
  for (let t = 0; t < 14; t += 0.35) {
    for (let row = 1; row < rows; row += 1) {
      const gap = Math.abs(clothShift(row / rows, t) - clothShift((row - 1) / rows, t));
      assert.ok(gap < 0.12, `rows ${row - 1} and ${row} are ${gap.toFixed(3)} units apart at ${t.toFixed(2)} s`);
    }
  }
});

test("the wave runs down the cloth: the crest at one row is at a different moment from the crest lower down", () => {
  const crestAt = (u) => { let best = -Infinity, at = 0; for (let t = 0; t < 6.5; t += 0.01) { const v = clothShift(u, t); if (v > best) { best = v; at = t; } } return at; };
  assert.notEqual(crestAt(0.4), crestAt(0.9));
});

test("the sheen is bounded and moves with the wave", () => {
  const seen = new Set();
  for (let t = 0; t < 7; t += 0.1) for (let u = 0; u <= 1; u += 0.1) {
    const sheen = clothSheen(u, t, 250);
    assert.ok(sheen >= -1 && sheen <= 1);
    seen.add(Math.sign(sheen));
  }
  assert.ok(seen.has(1) && seen.has(-1), "both light and shade appear as the cloth moves");
});
