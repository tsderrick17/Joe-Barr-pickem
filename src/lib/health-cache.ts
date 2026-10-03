/**
 * How long Vercel's CDN may serve a healthy probe answer before running the
 * function again. Each window is well inside the freshness window the probe
 * itself enforces, so caching only delays a newly failing signal by minutes,
 * never past its own grace period. Failures are never cached.
 */
export const HEALTH_CDN_SECONDS = {
  automation: 1200, // heartbeat window is 35 minutes
  criticalWorkers: 600, // windows are 12-45 minutes plus a 10-minute debounce
  settlement: 3600, // grace is 6 hours after kickoff
  bowlPool: 3600, // schedule and grading readiness changes slowly
  backup: 21600, // backup window is 8 days
} as const;

/** Cache-Control for an uptime probe: CDN-cached when healthy, never when failing. */
export function healthProbeCacheControl(healthy: boolean, cdnSeconds: number) {
  return healthy ? `public, max-age=0, s-maxage=${cdnSeconds}` : "no-store, max-age=0";
}
