const DEFAULT_MAX_AGE_MINUTES = 20;

/**
 * Convert the latest watchdog receipt into a deliberately small public health
 * result. The watchdog runs every five minutes, so twenty minutes allows
 * delayed delivery and cold starts without hiding repeated missed runs.
 */
export function assessAutomationHeartbeat(latestRun, now = new Date(), maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES) {
  if (!latestRun) return { healthy: false, reason: "missing" };
  if (latestRun.status !== "success") return { healthy: false, reason: "failed" };

  const timestamp = latestRun.completed_at ?? latestRun.started_at;
  const completedAt = timestamp ? new Date(timestamp) : null;
  if (!completedAt || Number.isNaN(completedAt.getTime())) return { healthy: false, reason: "invalid" };

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - completedAt.getTime()) / 1000));
  return {
    healthy: ageSeconds <= maxAgeMinutes * 60,
    reason: ageSeconds <= maxAgeMinutes * 60 ? "current" : "stale",
    ageSeconds,
  };
}

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

