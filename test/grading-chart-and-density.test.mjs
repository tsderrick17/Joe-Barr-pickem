import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chart = await readFile(new URL("../src/components/provider-chart.tsx", import.meta.url), "utf8");
const latency = await readFile(new URL("../src/components/latency-views-panel.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/components/grading-dashboard.tsx", import.meta.url), "utf8");
const efficiency = await readFile(new URL("../src/components/efficiency-trend-panel.tsx", import.meta.url), "utf8");
const slate = await readFile(new URL("../src/components/slate-performance-panel.tsx", import.meta.url), "utf8");
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
  assert.match(chart, /Math\.min\(64, Math\.max\(2, plotWidth \/ Math\.max\(1, points\.length\) \* \.56\)\)/);
});

test("credit usage chart uses an integer-only y-axis", () => {
  assert.match(chart, /integerYAxis\?: boolean/);
  assert.match(chart, /integerYAxis \? Math\.ceil\(scaleMax\(highest\) \/ 4\) \* 4/);
  assert.match(efficiency, /label="Current-month credit usage" integerYAxis/);
});

test("combined provider chart names independent credit and minute axes and nests latency detail", () => {
  assert.match(chart, /rightAxis\?: \{ label: string; suffix: string; scale\?: "zero" \| "tight" \}/);
  assert.match(chart, /rightMinimum \+ \(rightMaximum - rightMinimum\) \* fraction/);
  assert.match(slate, /yAxisLabel="Credits \/ game"/);
  assert.match(slate, /rightAxis=\{\{ label: "Minutes to final", suffix: "m", scale: "tight" \}\}/);
  assert.match(slate, /15-day avg · credits\/game/);
  assert.match(slate, /<LatencyViewsPanel metric=\{latencyMetric\} embedded \/>/);
  assert.doesNotMatch(dashboard, /<LatencyViewsPanel metric=\{metric\} \/>/);
});

test("the grading period control is a compact sticky rail, and commissioner cards collapse at tablet widths", () => {
  assert.match(dashboard, /sticky top-2 z-20/);
  assert.ok(css.includes('[aria-labelledby="grading-dashboard-title"] > .sticky { border-radius: .45rem; padding: .35rem .7rem !important;'));
  assert.ok(css.includes(".grading-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }"));
  assert.ok(css.includes(".grading-desk > .sticky { top: calc(var(--site-nav-height, 2.6rem) + .25rem); }"));
  assert.match(css, /\.commissioner-map \{ padding-block: 1rem !important; \}/);
});

test("grading cards, worker columns, and operations actions keep stable non-overlapping layouts", async () => {
  const operations = await readFile(new URL("../src/components/commissioner-operations-map.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /grading-worker-table w-full min-w-\[48rem\] table-fixed/);
  assert.match(dashboard, /<colgroup><col className="w-\[18%\]" \/><col className="w-\[14%\]" \/><col className="w-\[34%\]" \/><col className="w-\[34%\]" \/><\/colgroup>/);
  assert.match(css, /\.grading-kpi > p \{[^}]*min-height: 2\.3em/);
  assert.match(css, /\.commissioner-inline-action \{[^}]*display: inline-flex/);
  assert.match(operations, /commissioner-map-next/);
});

test("credit comparison replaces provider-report noise with the regular-season Sunday average", () => {
  assert.match(efficiency, /Regular-season Sunday average/);
  assert.match(efficiency, /creditUsage\.sundayAverageCredits/);
  assert.match(efficiency, /regularSundaysElapsed/);
  assert.doesNotMatch(efficiency, /\[\["Provider used", creditUsage\.reportedUsed\]/);
});
