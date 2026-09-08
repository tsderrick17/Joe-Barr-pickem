const CRITICAL_WORKERS = {
  // Keep probe cadence separate from cron-delivery jitter.
  line_locks: 12 * 60,
  scores: 45 * 60,
  reminders: 20 * 60,
};

const WORKER_LABELS = {
  line_locks: "Official-line locking",
  scores: "Final-score checking",
  reminders: "Reminder delivery",
};

export function describeCriticalWorkerProblem(problem) {
  const label = WORKER_LABELS[problem.jobName];
  if (problem.reason === "missing") return `${label} has not recorded a successful run while work is due.`;
  if (problem.reason === "failed") return `${label} failed after its last successful run.`;
  if (problem.reason === "stale") return `${label} is overdue for a successful run while work is due.`;
  return `${label} has an invalid heartbeat timestamp.`;
}

/**
 * A worker is healthy only after a recent success. A later failure overrides
 * that success until the next successful invocation.
 */
export function assessCriticalWorkerHeartbeats(rows, now = new Date(), {
  lineLocksDue = true,
  scoresDue = true,
  remindersDue = true,
} = {}) {
  const byJob = new Map((rows ?? []).map((row) => [row.job_name, row]));
  const problems = [];

  for (const [jobName, maximumAgeSeconds] of Object.entries(CRITICAL_WORKERS)) {
    const row = byJob.get(jobName);
    if (!row?.last_succeeded_at) {
      if ((jobName === "line_locks" && !lineLocksDue) || (jobName === "scores" && !scoresDue) || (jobName === "reminders" && !remindersDue)) continue;
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
    const workNotDue = (jobName === "line_locks" && !lineLocksDue) || (jobName === "scores" && !scoresDue) || (jobName === "reminders" && !remindersDue);
    if (ageSeconds > maximumAgeSeconds && !workNotDue) {
      problems.push({ jobName, reason: "stale" });
    }
  }

  return { healthy: problems.length === 0, problems };
}
