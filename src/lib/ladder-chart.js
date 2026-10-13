/** The first ten retry windows are charted; the last two (the 120- and 240-minute emergency windows) are one count below. */
export const CHARTED_WINDOWS = 10;

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
  return { points, total, emergencyFinals: emergency.reduce((sum, item) => sum + item.newFinals, 0), emergencyMinutes: emergency.map((item) => item.windowMinutes) };
}
