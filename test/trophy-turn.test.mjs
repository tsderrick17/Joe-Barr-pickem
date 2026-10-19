import test from "node:test";
import assert from "node:assert/strict";
import { loadOrder } from "../src/lib/trophy-turn.js";

test("every picture is fetched exactly once, the resting views first", () => {
  const order = loadOrder(120, 40);
  assert.equal(order.length, 120);
  assert.equal(new Set(order).size, 120);
  assert.deepEqual(order.slice(0, 3), [0, 40, 80]);
});

test("at every stage the pictures fetched so far are spread evenly round the table, never bunched near the resting views", () => {
  const order = loadOrder(120, 40);
  const widestGap = (count) => {
    const have = [...order.slice(0, count)].sort((a, b) => a - b);
    return Math.max(...have.map((index, i) => (have[(i + 1) % have.length] - index + 120) % 120 || 120));
  };
  assert.ok(widestGap(12) <= 10, "after every 10th picture the biggest gap is 10");
  assert.ok(widestGap(24) <= 5, "then 5");
  assert.ok(widestGap(72) <= 2, "then 2");
  assert.equal(widestGap(120), 1);
});
