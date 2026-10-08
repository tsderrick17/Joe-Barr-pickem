/**
 * The y-axis arithmetic of the Commissioner charts, as pure functions so it can be tested with numbers.
 * "zero" axes start at 0; "tight" axes start just under the lowest observed value so a narrow range is readable.
 */
export type AxisScale = "zero" | "tight";

/** The 1 / 2 / 5 / 10 step at or above `value` (never below .01). */
export function niceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, .01)));
  const fraction = value / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
}

/** A top for a zero-based axis: close to the data (15% headroom, rounded up to 10), never below 4. */
export function scaleMax(value: number) {
  if (value <= 0) return 4;
  // Keep the top gridline close to the observed data. The previous 1/2/5
  // ladder could turn a ~200-minute period into a 400-minute chart.
  return Math.max(4, Math.ceil((value * 1.15) / 10) * 10);
}

/** The left axis. `observed` are the plotted values, `highest` the tallest bar or stack. */
export function leftDomain({ observed, highest, scale = "zero", histogram = false, integer = false }: { observed: number[]; highest: number; scale?: AxisScale; histogram?: boolean; integer?: boolean }) {
  const observedMin = observed.length ? Math.min(...observed) : 0;
  const observedMax = observed.length ? Math.max(...observed) : 0;
  const rawRange = Math.max(observedMax - observedMin, Math.abs(observedMax) * .08, 1);
  const step = niceStep(rawRange / 4);
  const tight = scale === "tight" && observed.length > 0;
  const minimum = tight ? Math.max(0, Math.floor((observedMin - step) / step) * step) : 0;
  const maximum = histogram
    ? Math.max(4, Math.ceil(highest / 4) * 4)
    : tight
      ? Math.max(minimum + step, Math.ceil((observedMax + step) / step) * step)
      : integer ? Math.ceil(scaleMax(highest) / 4) * 4 : scaleMax(highest);
  return { minimum, maximum };
}

/** The optional right axis (an independent scale, e.g. minutes beside credits). With no right axis it is 0 to 100. */
export function rightDomain({ values, scale, present }: { values: number[]; scale?: AxisScale; present: boolean }) {
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const step = niceStep(Math.max(max - min, max * .08, 1) / 4);
  const tight = scale === "tight" && values.length > 0;
  const minimum = tight ? Math.max(0, Math.floor((min - step) / step) * step) : 0;
  const maximum = tight ? Math.max(minimum + step, Math.ceil((max + step) / step) * step) : present ? scaleMax(max) : 100;
  return { minimum, maximum };
}
