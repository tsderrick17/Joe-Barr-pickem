const CRITICAL_WORKERS = {
  line_locks: 5 * 60,
  scores: 35 * 60,
  reminders: 12 * 60,
};

/**
 * A worker is healthy only after a recent success. A later failure overrides
 * that success until the next successful invocation.
 */
export function assessCriticalWorkerHeartbeats(rows, now = new Date()) {
  const byJob = new Map((rows ?? []).map((row) => [row.job_name, row]));
  const problems = [];

  for (const [jobName, maximumAgeSeconds] of Object.entries(CRITICAL_WORKERS)) {
    const row = byJob.get(jobName);
    if (!row?.last_succeeded_at) {
      problems.push({ jobName, reason: "missing" });
      continue;
    }

    const succeededAt = new Date(row.last_succeeded_at);
    const failedAt = row.last_failed_at ? new Date(row.last_failed_at) : null;
    if (Number.isNaN(succeededAt.getTime())) {
      problems.push({ jobName, reason: "invalid" });
      continue;
    }
    if (failedAt && !Number.isNaN(failedAt.getTime()) && failedAt > succeededAt) {
      problems.push({ jobName, reason: "failed" });
      continue;
    }

    const ageSeconds = Math.max(0, Math.floor((now.getTime() - succeededAt.getTime()) / 1000));
    if (ageSeconds > maximumAgeSeconds) problems.push({ jobName, reason: "stale" });
  }

  return { healthy: problems.length === 0, problems };
}
