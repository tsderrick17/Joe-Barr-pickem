// @ts-check

/**
 * A date formatter for these options, built once and then reused. Building an `Intl.DateTimeFormat` costs about 80 µs and using one about 5 µs,
 * and the pool formats dates in loops (every game on the Slate, every pick in the playoff math, every point on the Grading charts), so each
 * distinct format is kept instead of rebuilt on every call. A formatter never changes once built, so sharing one is safe.
 */
const kept = new Map();

/**
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {Intl.DateTimeFormat}
 */
export function dateFormat(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = kept.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    kept.set(key, formatter);
  }
  return formatter;
}
