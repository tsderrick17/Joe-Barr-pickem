import assert from "node:assert/strict";
import test from "node:test";
import { fitBanners } from "../src/lib/banner-fit.js";

const MAX = 137.6, MIN = 96, GAP = 0.8 / 8.6;
const fit = (count, width) => fitBanners({ count, width, max: MAX, min: MIN, gapRatio: GAP });
const rowWidth = ({ size, gap }, n) => n * size + (n - 1) * gap;
const total = (lines) => lines.reduce((sum, n) => sum + n, 0);

test("banners that fit keep their full size in one row", () => {
  for (const count of [1, 2, 3, 5]) {
    const room = fit(count, 900);
    assert.equal(room.size, MAX);
    assert.deepEqual(room.lines, [count]);
  }
  assert.deepEqual(fit(0, 900).lines, []);
});

test("more banners shrink together to stay in one row, never wider than the row", () => {
  const room = fit(7, 900);
  assert.deepEqual(room.lines, [7]);
  assert.ok(room.size < MAX && room.size >= MIN);
  assert.ok(Math.abs(rowWidth(room, 7) - 900) < 0.01);
  // a phone: three banners share one row instead of wrapping two and one
  const phone = fit(3, 326);
  assert.deepEqual(phone.lines, [3]);
  assert.ok(rowWidth(phone, 3) <= 326.01);
});

test("only when they would be smaller than the minimum do they go onto more lines, at the small size, as even as possible, longer lines first", () => {
  assert.deepEqual(fit(4, 326).lines, [2, 2]);
  assert.deepEqual(fit(7, 326).lines, [3, 2, 2]);
  const phone = fit(7, 326);
  assert.ok(phone.size >= MIN && phone.size < MAX);
  assert.ok(rowWidth(phone, 3) <= 326.01);
  const desk = fit(12, 900);
  assert.ok(desk.size >= MIN);
  assert.equal(total(desk.lines), 12);
  assert.ok(Math.max(...desk.lines) - Math.min(...desk.lines) <= 1);
  assert.ok(rowWidth(desk, desk.lines[0]) <= 900.01);
});

test("the size never grows as banners are added, and every banner has a place", () => {
  let last = Infinity;
  for (let count = 1; count <= 30; count += 1) {
    const { size, lines } = fit(count, 600);
    assert.ok(size <= last + 1e-9, `${count} banners`);
    assert.equal(total(lines), count);
    assert.deepEqual(lines, [...lines].sort((a, b) => b - a), "longer lines first");
    last = size;
  }
});
