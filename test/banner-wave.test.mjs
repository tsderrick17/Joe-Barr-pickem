import assert from "node:assert/strict";
import test from "node:test";
import { bannerFeel, clothSheen, clothShift, gust } from "../src/lib/banner-wave.js";

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

/** How closely two banners' hems move together over a minute: 1 is in exact unison. */
function unison(a, b) {
  let ab = 0, aa = 0, bb = 0;
  for (let t = 0; t < 60; t += 0.05) {
    const x = clothShift(1, t, a), y = clothShift(1, t, b);
    ab += x * y; aa += x * x; bb += y * y;
  }
  return ab / Math.sqrt(aa * bb);
}

test("no two banners in a row move in step, on any visit", () => {
  for (const random of [0, 0.13, 0.5, 0.77, 0.99]) {
    const feels = [0, 1, 2, 3, 4, 5].map((index) => bannerFeel(index, random));
    for (let i = 0; i < feels.length; i += 1) for (let j = i + 1; j < feels.length; j += 1) {
      const together = unison(feels[i], feels[j]);
      assert.ok(together < 0.8, `banners ${i} and ${j} move together ${together.toFixed(2)} (random ${random})`);
    }
  }
});

test("each banner keeps its own pace and reach within gentle limits", () => {
  for (let index = 0; index < 8; index += 1) for (const random of [0, 0.4, 0.9]) {
    const feel = bannerFeel(index, random);
    assert.ok(feel.pace >= 0.86 && feel.pace <= 1.14);
    assert.ok(feel.reach >= 0.8 && feel.reach <= 1);
  }
  for (let t = 0; t < 120; t += 0.25) assert.ok(gust(t) >= 0.85 && gust(t) <= 1.05);
});

test("a banner with its own feel still hangs from the rod, stays within its room and bends smoothly", () => {
  const feel = bannerFeel(3, 0.42);
  let nearRod = 0, nearHem = 0;
  for (let t = 0; t < 60; t += 0.05) {
    nearRod = Math.max(nearRod, Math.abs(clothShift(0, t, feel)));
    nearHem = Math.max(nearHem, Math.abs(clothShift(1, t, feel)));
    if (Math.round(t * 20) % 7 === 0) for (let row = 1; row < 320; row += 1) assert.ok(Math.abs(clothShift(row / 320, t, feel) - clothShift((row - 1) / 320, t, feel)) < 0.12);
  }
  assert.ok(nearRod < 0.5);
  assert.ok(nearHem > 4 && nearHem < 10, `hem ${nearHem.toFixed(2)}`);
});
