/**
 * The numbers pages' charts: the arithmetic behind every line, column and histogram, kept free of the browser so it can be tested directly.
 * Marks follow one spec: 2px lines, columns at most 24px wide with a 4px rounded top, a 2px gap between stacked parts, direct labels only at
 * the ends, and one y-axis.
 */

/** A round number at or above `value` for the top of an axis: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(value) {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
}

/** Evenly spaced axis ticks from `min` to `max`, `count` gaps. */
export function ticks(min, max, count = 4) {
  return Array.from({ length: count + 1 }, (_, index) => min + ((max - min) * index) / count);
}

/** The plot area inside a chart `width` x `height`, leaving room for the y labels, the x labels and, when asked, end labels on the right. */
export function plotArea(width, height, { left = 34, endLabels = false } = {}) {
  const margin = { left, right: endLabels ? 46 : 8, top: 18, bottom: 22 };
  return { ...margin, width: Math.max(0, width - margin.left - margin.right), height: Math.max(0, height - margin.top - margin.bottom) };
}

/** A y scale: value to px from the top. */
export function yScale(area, min, max) {
  const span = max - min || 1;
  return (value) => area.top + area.height - ((value - min) / span) * area.height;
}

/** An x scale for `count` points. Lines run edge to edge; columns sit in the middle of equal slots. */
export function xScale(area, count, columns = false) {
  if (columns) return (index) => area.left + ((index + 0.5) * area.width) / Math.max(1, count);
  return (index) => area.left + (count <= 1 ? area.width / 2 : (index * area.width) / (count - 1));
}

/** One line's path through its points, skipping missing values (a gap starts a new segment). */
export function linePath(values, x, y) {
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null || value === undefined || Number.isNaN(value)) { drawing = false; return; }
    path += `${drawing ? "L" : "M"}${round(x(index))} ${round(y(value))}`;
    drawing = true;
  });
  return path;
}

/** The first and last index that have a value, or null for an empty series. */
export function extent(values) {
  const first = values.findIndex((value) => value !== null && value !== undefined);
  if (first < 0) return null;
  let last = values.length - 1;
  while (values[last] === null || values[last] === undefined) last -= 1;
  return { first, last };
}

/** Column width for `count` slots across `width` px: never wider than 24px, never narrower than 3px, with at least 2px between columns. */
export function columnWidth(width, count) {
  return Math.max(3, Math.min(24, width / Math.max(1, count) - 2));
}

/**
 * The parts of one stacked column, bottom up: each part's top and height in px, with a 2px gap between parts. Zero and missing parts are left out;
 * only the top part gets the rounded top.
 */
export function stackParts(values, y, base = 0) {
  const parts = [];
  let total = base;
  const present = values.map((value, series) => ({ value: Number(value) || 0, series })).filter((part) => part.value > 0);
  present.forEach((part, index) => {
    const bottom = y(total);
    total += part.value;
    const top = y(total);
    const last = index === present.length - 1;
    parts.push({ series: part.series, top: round(last ? top : top + 2), height: round(Math.max(1, bottom - top - (last ? 0 : 2))), last });
  });
  return { parts, total };
}

/** A column's outline with a rounded top (radius 4, smaller when the column is short or thin) anchored to its base. */
export function roundedTop(x, top, width, height, radius = 4) {
  const r = Math.min(radius, width / 2, height);
  return `M${round(x)} ${round(top + height)}V${round(top + r)}Q${round(x)} ${round(top)} ${round(x + r)} ${round(top)}H${round(x + width - r)}Q${round(x + width)} ${round(top)} ${round(x + width)} ${round(top + r)}V${round(top + height)}Z`;
}

/** End labels stacked so no two sit closer than `gap` px; each keeps its order. Input and output are y positions. */
export function spreadLabels(positions, gap = 14) {
  const order = positions.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < order.length; i += 1) if (order[i].y - order[i - 1].y < gap) order[i].y = order[i - 1].y + gap;
  const out = [];
  order.forEach((item) => { out[item.index] = item.y; });
  return out;
}

/** Which point a pointer `px` from the chart's left edge is over. */
export function nearestIndex(px, area, count, columns = false) {
  const slot = columns ? area.width / Math.max(1, count) : area.width / Math.max(1, count - 1);
  const raw = columns ? Math.floor((px - area.left) / slot) : Math.round((px - area.left) / slot);
  return Math.max(0, Math.min(count - 1, raw));
}

/**
 * A histogram whose bars are as wide as their time windows: a 10-minute window is twice a 5-minute one. Each bin is { start, end, value } in minutes;
 * bars sit edge to edge with a 2px gap.
 */
export function histogramBars(bins, area, y) {
  const span = bins.length ? bins[bins.length - 1].end - bins[0].start : 1;
  const origin = bins.length ? bins[0].start : 0;
  const x = (minutes) => area.left + ((minutes - origin) / (span || 1)) * area.width;
  return bins.map((bin) => {
    const left = x(bin.start) + 1, right = x(bin.end) - 1;
    const top = y(bin.value), bottom = y(0);
    return { x: round(left), width: round(Math.max(1, right - left)), top: round(top), height: round(Math.max(0, bottom - top)), centre: round((left + right) / 2) };
  });
}

/** A small trend line for a tile: the path, and where its last point is. */
export function sparkline(values, width = 64, height = 22) {
  const present = values.filter((value) => value !== null && value !== undefined);
  if (present.length < 2) return null;
  const min = Math.min(...present), max = Math.max(...present);
  const x = (index) => 1 + (index * (width - 4)) / (present.length - 1);
  const y = (value) => height - 3 - ((value - min) / (max - min || 1)) * (height - 6);
  return { path: present.map((value, index) => `${index ? "L" : "M"}${round(x(index))} ${round(y(value))}`).join(""), end: { x: round(x(present.length - 1)), y: round(y(present.at(-1))) } };
}

/** The share of the total that falls in bins ending at or before `minutes`, as a whole percent. */
export function shareWithin(bins, minutes) {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (!total) return null;
  return Math.round((bins.filter((bin) => bin.end <= minutes).reduce((sum, bin) => sum + bin.count, 0) / total) * 100);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
