const DEFAULT_MAX_AGE_MINUTES = (7 * 24 + 4) * 60;

/**
 * The backup runs weekly. Four hours of grace allows for a delayed GitHub
 * runner without hiding a missed or failed weekly restore verification.
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
