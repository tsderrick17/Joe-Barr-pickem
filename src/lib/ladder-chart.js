/** The first nine retry windows are charted; the last three (the 60-, 120- and 240-minute emergency windows) are one count below. */
export const CHARTED_WINDOWS = 9;

/**
 * @param {Array<{ rung: number, windowMinutes: number, newFinals: number }>} items every retry window, in order
 * Bars are each window's share of every fresh final ever recorded (emergency windows included), to one decimal.
 */
export function ladderChartData(items) {
  const total = items.reduce((sum, item) => sum + item.newFinals, 0);
  const share = (count) => (total ? Math.round((count / total) * 1000) / 10 : 0);
  const charted = items.slice(0, CHARTED_WINDOWS);
  const emergency = items.slice(CHARTED_WINDOWS);
  const points = charted.map((item, index) => {
    const start = charted.slice(0, index).reduce((sum, previous) => sum + previous.windowMinutes, 0);
    return {
      label: `Window ${item.rung} · ${item.windowMinutes}-minute polling gap`, shortLabel: `#${item.rung}`,
      start, end: start + item.windowMinutes, values: { finals: share(item.newFinals) },
      note: `${item.newFinals} fresh final${item.newFinals === 1 ? "" : "s"} · ${start}–${start + item.windowMinutes} minutes along the retry ladder`,
    };
  });
  // Axis labels every half hour from the first check, as minutes after it (+0m, +30m, ...).
  const end = points.at(-1)?.end ?? 0;
  const ticks = Array.from({ length: Math.floor(end / 30) + 1 }, (_, index) => index * 30);
  return { points, ticks, total, emergencyFinals: emergency.reduce((sum, item) => sum + item.newFinals, 0), emergencyMinutes: emergency.map((item) => item.windowMinutes) };
}
