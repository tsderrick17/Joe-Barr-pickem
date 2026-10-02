// pg_cron aims for five-minute delivery, but serverless dispatch is not a
// real-time clock. Thirty-five minutes tolerates bounded delivery jitter and
// several missed invocations without suppressing a genuinely stopped worker.
const DEFAULT_MAX_AGE_MINUTES = 35;

/**
 * Assess the constant-size worker receipt used by the public liveness probe.
 * Diagnostic watchdog runs may fail independently without taking liveness
 * down; freshness of the last success is the circuit breaker for repeated
 * failures.
 */
export function assessAutomationWorkerHeartbeat(row, now = new Date(), maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES) {
  if (!row?.last_succeeded_at) return { healthy: false, reason: "missing" };

  const succeededAt = new Date(row.last_succeeded_at);
  if (Number.isNaN(succeededAt.getTime())) return { healthy: false, reason: "invalid" };
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - succeededAt.getTime()) / 1000));
  return {
    healthy: ageSeconds <= maxAgeMinutes * 60,
    reason: ageSeconds <= maxAgeMinutes * 60 ? "current" : "stale",
    ageSeconds,
  };
}

