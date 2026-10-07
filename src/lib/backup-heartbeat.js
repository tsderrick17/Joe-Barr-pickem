const DEFAULT_MAX_AGE_MINUTES = 8 * 24 * 60;

/** @typedef {{ status?: unknown, conclusion?: unknown, updated_at?: unknown, run_started_at?: unknown, created_at?: unknown }} BackupWorkflowRun */
/** @typedef {{ healthy: boolean, reason: "missing" | "failed" | "invalid" | "current" | "stale", ageSeconds?: number }} BackupHeartbeatAssessment */

/**
 * The backup runs weekly. An eight-day window allows a delayed GitHub runner
 * without creating a predictable false alarm at the weekly boundary, while
 * still surfacing a genuinely missed or failed backup.
 * @param {BackupWorkflowRun | null | undefined} latestRun
 * @param {Date} [now]
 * @param {number} [maxAgeMinutes]
 * @returns {BackupHeartbeatAssessment}
 */
export function assessBackupWorkflowRun(latestRun, now = new Date(), maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES) {
  if (!latestRun) return { healthy: false, reason: "missing" };
  if (latestRun.status !== "completed" || latestRun.conclusion !== "success") {
    return { healthy: false, reason: "failed" };
  }

  const timestamp = latestRun.updated_at ?? latestRun.run_started_at ?? latestRun.created_at;
  const completedAt = typeof timestamp === "string" ? new Date(timestamp) : null;
  if (!completedAt || Number.isNaN(completedAt.getTime())) return { healthy: false, reason: "invalid" };

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - completedAt.getTime()) / 1000));
  return {
    healthy: ageSeconds <= maxAgeMinutes * 60,
    reason: ageSeconds <= maxAgeMinutes * 60 ? "current" : "stale",
    ageSeconds,
  };
}
