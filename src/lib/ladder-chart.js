/**
 * The windows that are drawn are the short ones: every window up to the first gap longer than this (the 5- and 10-minute windows). The
 * longer windows (20 minutes and up, and the last check, which has no gap after it) are rare, so they are one count below the chart.
 */
const CHARTED_MAX_GAP_MINUTES = 10;

/**
 * @param {Array<{ rung: number, windowMinutes: number, newFinals: number }>} items every retry window, in order (a last item with a
 *   windowMinutes of 0 is the final check, which has no gap after it)
 * Bars are each window's share of every fresh final ever recorded (the later windows included), to one decimal.
 */
export function ladderChartData(items) {
  const total = items.reduce((sum, item) => sum + item.newFinals, 0);
  const share = (count) => (total ? Math.round((count / total) * 1000) / 10 : 0);
  const firstLong = items.findIndex((item) => item.windowMinutes > CHARTED_MAX_GAP_MINUTES || item.windowMinutes <= 0);
  const chartedCount = firstLong === -1 ? items.length : firstLong;
  const charted = items.slice(0, chartedCount);
  const later = items.slice(chartedCount);
  const points = charted.map((item, index) => {
    const start = charted.slice(0, index).reduce((sum, previous) => sum + previous.windowMinutes, 0);
    return {
      label: `Window ${item.rung} · ${item.windowMinutes}-minute polling gap`, shortLabel: `#${item.rung}`,
      start, end: start + item.windowMinutes, values: { finals: share(item.newFinals) },
      note: `${item.newFinals} fresh final${item.newFinals === 1 ? "" : "s"} · ${start}–${start + item.windowMinutes} minutes along the retry ladder`,
    };
  });
  // Axis labels from the first check, as minutes after it (+0m, +15m, ... for a short chart, every half hour for a long one).
  const end = points.at(-1)?.end ?? 0;
  const step = end > 60 ? 30 : 15;
  const ticks = Array.from({ length: Math.floor(end / step) + 1 }, (_, index) => index * step);
  const laterMinutes = [...new Set(later.map((item) => item.windowMinutes).filter((minutes) => minutes > 0))];
  return {
    points, ticks, total,
    laterFinals: later.reduce((sum, item) => sum + item.newFinals, 0), laterMinutes,
    // Whether the last check (no gap after it) is among the later windows, so the note can say so.
    laterIncludesLastCheck: later.some((item) => item.windowMinutes <= 0),
  };
}
