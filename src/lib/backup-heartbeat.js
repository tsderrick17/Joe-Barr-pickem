const DEFAULT_MAX_AGE_MINUTES = 2 * 24 * 60;

/**
 * The backup runs daily. A two-day window allows a GitHub runner that starts
 * hours late (scheduled runs have started up to nine hours late) without a
 * false alarm, while surfacing a missed day by the next one; a failed run is
 * unhealthy at once.
 */
export function assessBackupWorkflowRun(latestRun, now = new Date(), maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES) {
  if (!latestRun) return { healthy: false, reason: "missing" };
  if (latestRun.status !== "completed" || latestRun.conclusion !== "success") {
    return { healthy: false, reason: "failed" };
  }

  const timestamp = latestRun.updated_at ?? latestRun.run_started_at ?? latestRun.created_at;
  const completedAt = timestamp ? new Date(timestamp) : null;
  if (!completedAt || Number.isNaN(completedAt.getTime())) return { healthy: false, reason: "invalid" };

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - completedAt.getTime()) / 1000));
  return {
    healthy: ageSeconds <= maxAgeMinutes * 60,
    reason: ageSeconds <= maxAgeMinutes * 60 ? "current" : "stale",
    ageSeconds,
  };
}
