export const MAX_FALLBACK_LINE_AGE_MS = 24 * 60 * 60 * 1000;

export function isFallbackLineFresh(capturedAt, checkedAt) {
  const age = Date.parse(checkedAt) - Date.parse(capturedAt);
  return Number.isFinite(age) && age >= 0 && age <= MAX_FALLBACK_LINE_AGE_MS;
}
