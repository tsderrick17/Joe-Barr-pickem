const DEFAULT_MAX_AGE_MINUTES = 12;

/**
 * Convert the latest watchdog receipt into a deliberately small public health
 * result. The watchdog runs every five minutes, so twelve minutes allows one
 * delayed run without hiding two consecutive missed runs.
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

