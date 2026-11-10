import assert from "node:assert/strict";
import test from "node:test";
import {
  columnWidth, extent, histogramBars, linePath, nearestIndex, niceMax, plotArea, roundedTop, shareWithin, sparkline, spreadLabels, stackParts, ticks, xScale, yScale,
} from "../src/lib/dash-chart.js";

const area = plotArea(434, 200);   // a 400 x 160 plot

test("axis tops are round numbers at or above the data", () => {
  assert.deepEqual([niceMax(88), niceMax(252), niceMax(500), niceMax(3.6), niceMax(0)], [100, 500, 500, 5, 1]);
  assert.deepEqual(ticks(0, 500), [0, 125, 250, 375, 500]);
});

test("end labels make room on the right", () => {
  assert.equal(plotArea(434, 200).width, 392);
  assert.equal(plotArea(434, 200, { endLabels: true }).width, 354);
});

test("scales put the bottom of the axis at the bottom of the plot", () => {
  const y = yScale(area, 0, 100);
  assert.equal(y(0), area.top + area.height);
  assert.equal(y(100), area.top);
  const x = xScale(area, 5);
  assert.deepEqual([x(0), x(4)], [area.left, area.left + area.width]);
  const column = xScale(area, 4, true);
  assert.equal(column(0), area.left + area.width / 8, "a column sits in the middle of its slot");
});

test("a line skips missing days instead of dropping to zero", () => {
  const y = yScale(area, 0, 10), x = xScale(area, 4);
  const path = linePath([1, null, 3, 4], x, y);
  assert.equal((path.match(/M/g) ?? []).length, 2);
  assert.equal(linePath([null, null], x, y), "");
  assert.deepEqual(extent([null, 2, 3, null]), { first: 1, last: 2 });
  assert.equal(extent([null]), null);
});

test("columns are at most 24px wide and keep a gap", () => {
  assert.equal(columnWidth(400, 3), 24);
  assert.equal(columnWidth(400, 30), 400 / 30 - 2);
  assert.equal(columnWidth(30, 30), 3);
});

test("stacked parts leave a 2px gap and only the top one is rounded", () => {
  const y = yScale(area, 0, 40);
  const { parts, total } = stackParts([30, 0, 6], y);
  assert.equal(total, 36);
  assert.deepEqual(parts.map((part) => [part.series, part.last]), [[0, false], [2, true]]);
  assert.ok(Math.abs(parts[0].top - (parts[1].top + parts[1].height) - 2) < 0.02, "2px between the parts");
});

test("a rounded top never rounds more than the column allows", () => {
  assert.match(roundedTop(0, 10, 2, 50), /Q0 10 1 10/);
  assert.match(roundedTop(0, 10, 24, 2), /V12Q0 10 2 10/);
});

test("end labels never overlap and keep their order", () => {
  assert.deepEqual(spreadLabels([100, 104]), [100, 114]);
  assert.deepEqual(spreadLabels([104, 100]), [114, 100]);
  assert.deepEqual(spreadLabels([50, 120]), [50, 120]);
});

test("the pointer finds the nearest point or column", () => {
  assert.equal(nearestIndex(area.left, area, 5), 0);
  assert.equal(nearestIndex(area.left + area.width, area, 5), 4);
  assert.equal(nearestIndex(area.left + area.width * 0.6, area, 5), 2);
  assert.equal(nearestIndex(area.left + 1, area, 4, true), 0);
  assert.equal(nearestIndex(-50, area, 4, true), 0);
  assert.equal(nearestIndex(9999, area, 4, true), 3);
});

test("a histogram bar is as wide as its time window", () => {
  const y = yScale(area, 0, 60);
  const bars = histogramBars([{ start: 0, end: 5, value: 46 }, { start: 5, end: 10, value: 37 }, { start: 10, end: 20, value: 11 }, { start: 20, end: 40, value: 4 }], area, y);
  const slot = (bar) => bar.width + 2;
  assert.ok(Math.abs(slot(bars[2]) - 2 * slot(bars[1])) < 0.05, "10 minutes is twice 5");
  assert.ok(Math.abs(slot(bars[3]) - 2 * slot(bars[2])) < 0.05, "20 minutes is twice 10");
  assert.ok(bars[0].height > bars[1].height);
});

test("the share within ten minutes counts the windows that end by then", () => {
  const bins = [{ end: 5, count: 46 }, { end: 10, count: 37 }, { end: 20, count: 17 }];
  assert.equal(shareWithin(bins, 10), 83);
  assert.equal(shareWithin([], 10), null);
});

test("a sparkline needs two points and ends on the latest", () => {
  assert.equal(sparkline([3]), null);
  const line = sparkline([3, null, 2, 1]);
  assert.ok(line);
  assert.ok(line.end.y > 10, "the latest (lowest) value sits low");
});
