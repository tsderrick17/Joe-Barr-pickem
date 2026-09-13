export const CRITICAL_WORKER_DEBOUNCE_MINUTES = 10;

export function isProbeHealthyAfterDebounce({ healthy, unhealthySince }, checkedAt = new Date()) {
  if (healthy) return true;
  if (!unhealthySince) return true;

  const started = new Date(unhealthySince);
  if (Number.isNaN(started.getTime())) return false;
  return checkedAt.getTime() - started.getTime() < CRITICAL_WORKER_DEBOUNCE_MINUTES * 60 * 1000;
}
