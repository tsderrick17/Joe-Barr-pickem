import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { niceStep, scaleMax, leftDomain, rightDomain } = await import("../src/lib/chart-axis.ts");

test("a nice step is the next 1, 2, 5 or 10 at its magnitude", () => {
  assert.equal(niceStep(0.3), 0.5);
  assert.equal(niceStep(1), 1);
  assert.equal(niceStep(1.5), 2);
  assert.equal(niceStep(4), 5);
  assert.equal(niceStep(7), 10);
  assert.equal(niceStep(0), 0.01, "never below .01");
});

test("a zero-based top stays close to the data: 15% headroom, rounded up to 10, never below 4", () => {
  assert.equal(scaleMax(0), 4);
  assert.equal(scaleMax(-3), 4);
  assert.equal(scaleMax(3), 10);
  assert.equal(scaleMax(200), 230, "a 200-minute period is a 230-minute chart, not 400");
  assert.equal(scaleMax(201), 240);
});

test("zero, integer and histogram axes", () => {
  assert.deepEqual(leftDomain({ observed: [10, 20], highest: 20 }), { minimum: 0, maximum: 30 });
  assert.deepEqual(leftDomain({ observed: [10, 20], highest: 20, integer: true }), { minimum: 0, maximum: 32 }, "an integer axis tops out on a multiple of 4");
  assert.deepEqual(leftDomain({ observed: [], highest: 9, histogram: true }), { minimum: 0, maximum: 12 });
  assert.deepEqual(leftDomain({ observed: [], highest: 0, histogram: true }), { minimum: 0, maximum: 4 }, "a histogram has at least 4 gridlines of room");
});

test("a tight axis hugs the data on rounded steps, never below zero, and falls back to zero-based with no data", () => {
  assert.deepEqual(leftDomain({ observed: [180, 200, 210], highest: 210, scale: "tight" }), { minimum: 170, maximum: 220 });
  assert.deepEqual(leftDomain({ observed: [1, 2], highest: 2, scale: "tight" }), { minimum: 0.5, maximum: 2.5 });
  assert.deepEqual(leftDomain({ observed: [3, 40], highest: 40, scale: "tight" }), { minimum: 0, maximum: 50 }, "the floor is clamped at zero");
  assert.deepEqual(leftDomain({ observed: [], highest: 0, scale: "tight" }), { minimum: 0, maximum: 4 });
});

test("the right axis is independent of the left one", () => {
  assert.deepEqual(rightDomain({ values: [], present: false }), { minimum: 0, maximum: 100 }, "no right axis at all");
  assert.deepEqual(rightDomain({ values: [5], present: true }), { minimum: 0, maximum: 10 });
  assert.deepEqual(rightDomain({ values: [40, 60], scale: "tight", present: true }), { minimum: 35, maximum: 65 });
  assert.deepEqual(rightDomain({ values: [], scale: "tight", present: true }), { minimum: 0, maximum: 4 });
});
