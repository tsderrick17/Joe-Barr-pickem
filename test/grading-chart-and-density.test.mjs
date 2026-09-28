import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chart = await readFile(new URL("../src/components/provider-chart.tsx", import.meta.url), "utf8");
const latency = await readFile(new URL("../src/components/latency-views-panel.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/components/grading-dashboard-live.tsx", import.meta.url), "utf8");
const efficiency = await readFile(new URL("../src/components/efficiency-trend-panel.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("settlement latency uses a rounded, data-relative y-axis and names its units", () => {
  assert.match(chart, /yScale\?: "zero" \| "tight"/);
  assert.match(chart, /const minimum = yScale === "tight"/);
  assert.match(chart, /function niceStep\(/);
  assert.match(chart, /minimum \+ \(maximum - minimum\) \* fraction/);
  assert.match(latency, /yScale="tight" yAxisLabel="Minutes to final"/);
});

test("categorical charts center bars and labels inside each day instead of clipping the end bars", () => {
  assert.match(chart, /\(index \+ \.5\) \/ Math\.max\(1, points\.length\)/);
  assert.match(chart, /Math\.floor\(position \* points\.length\)/);
});

test("the grading period control is a compact sticky rail, and commissioner cards collapse at tablet widths", () => {
  assert.match(dashboard, /sticky top-2 z-20/);
  assert.ok(css.includes('[aria-labelledby="grading-dashboard-title"] > .sticky { border-radius: .45rem; padding: .35rem .7rem !important;'));
  assert.ok(css.includes('[aria-labelledby="grading-dashboard-title"] > .mt-5.grid.md\\:grid-cols-2 {'));
  assert.match(css, /\.commissioner-map \{ padding-block: 1rem !important; \}/);
});

test("credit comparison replaces provider-report noise with the regular-season Sunday average", () => {
  assert.match(efficiency, /Regular-season Sunday average/);
  assert.match(efficiency, /creditUsage\.sundayAverageCredits/);
  assert.match(efficiency, /regularSundaysElapsed/);
  assert.doesNotMatch(efficiency, /\[\["Provider used", creditUsage\.reportedUsed\]/);
});
