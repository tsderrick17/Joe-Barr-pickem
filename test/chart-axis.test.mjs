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
  // A percentage histogram tops out on a multiple of 20, so its gridlines read 0, 5, 10, 15, 20 (or 0, 10, 20, 30, 40).
  assert.deepEqual(leftDomain({ observed: [], highest: 12, histogram: true, histogramStep: 20 }), { minimum: 0, maximum: 20 });
  assert.deepEqual(leftDomain({ observed: [], highest: 38.4, histogram: true, histogramStep: 20 }), { minimum: 0, maximum: 40 });
  assert.deepEqual(leftDomain({ observed: [], highest: 0, histogram: true, histogramStep: 20 }), { minimum: 0, maximum: 20 });
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

test("the polling ladder charts the 5- and 10-minute windows as shares of every final, with the later windows as one count", async () => {
  const { ladderChartData } = await import("../src/lib/ladder-chart.js");
  const { SCORE_RETRY_MINUTES } = await import("../src/lib/score-retry-ladder.js");
  // One item per check, the last (no gap after it) with a window of 0, as the Grading route builds them.
  const minutes = [...SCORE_RETRY_MINUTES, 0];
  const counts = [16, 17, 12, 2, 1, 0, 0, 3, 1, 0, 0, 0, 1, 0, 1, 2];
  assert.equal(counts.length, minutes.length);
  const { points, ticks, total, laterFinals, laterMinutes, laterIncludesLastCheck } = ladderChartData(minutes.map((windowMinutes, index) => ({ rung: index + 1, windowMinutes, newFinals: counts[index] })));
  assert.equal(points.length, 9, "the seven 5-minute and two 10-minute windows are charted; the 20-minute windows and later are not");
  assert.equal(total, 56, "shares are of every final, the later windows and the last check included");
  assert.equal(points[0].values.finals, 28.6, "16 of 56 finals");
  assert.equal(points[2].values.finals, 21.4);
  assert.deepEqual([points[0].start, points[0].end, points[7].start, points[7].end, points[8].end], [0, 5, 35, 45, 55], "bar width is the retry gap");
  assert.deepEqual(ticks, [0, 15, 30, 45], "a short chart is labelled every quarter hour from the first check");
  assert.equal(laterFinals, 4, "finals found on the 20-minute windows, the 60, 120 and 240 windows and the last check");
  assert.deepEqual(laterMinutes, [20, 60, 120, 240]);
  assert.equal(laterIncludesLastCheck, true);
  assert.deepEqual(ladderChartData(minutes.map((windowMinutes, index) => ({ rung: index + 1, windowMinutes, newFinals: 0 }))).points.map((point) => point.values.finals), Array(9).fill(0), "no finals yet means empty bars, not a divide by zero");
  // A longer chart is labelled every half hour, as before.
  const long = ladderChartData([10, 10, 10, 10, 10, 10, 10, 10, 10, 20].map((windowMinutes, index) => ({ rung: index + 1, windowMinutes, newFinals: 1 })));
  assert.deepEqual(long.ticks, [0, 30, 60, 90]);
});
