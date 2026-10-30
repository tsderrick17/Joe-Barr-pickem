/**
 * How long Vercel's CDN may serve a healthy probe answer before running the
 * function again. Each window is well inside the freshness window the probe
 * itself enforces, so caching only delays a newly failing signal by minutes,
 * never past its own grace period. Failures are never cached.
 */
export const HEALTH_CDN_SECONDS = {
  automation: 1200, // heartbeat window is 35 minutes
  criticalWorkers: 600, // line locks (12-minute window) and the all-workers probe
  scoreWorker: 1500, // score checks allow 45 minutes
  reminderWorker: 900, // reminders allow 20 minutes
  settlement: 3600, // grace is 6 hours after kickoff
  bowlPool: 3600, // schedule and grading readiness changes slowly
  backup: 21600, // backup window is 8 days
  lines: 900, // a missed official line is reported 20 minutes after its lock time
  recap: 3600, // the Tuesday recap is reported 3 hours after it was due
  weekHandoff: 1800, // a week that failed to advance is reported 2 hours after its handoff time
} as const;

/** The CDN window for a critical-worker probe: each worker's own grace window decides how long a healthy answer may be kept. */
export function criticalWorkerCdnSeconds(worker?: "line_locks" | "scores" | "reminders") {
  if (worker === "scores") return HEALTH_CDN_SECONDS.scoreWorker;
  if (worker === "reminders") return HEALTH_CDN_SECONDS.reminderWorker;
  return HEALTH_CDN_SECONDS.criticalWorkers;
}

/** Cache-Control for an uptime probe: CDN-cached when healthy, never when failing. */
export function healthProbeCacheControl(healthy: boolean, cdnSeconds: number) {
  return healthy ? `public, max-age=0, s-maxage=${cdnSeconds}` : "no-store, max-age=0";
}
