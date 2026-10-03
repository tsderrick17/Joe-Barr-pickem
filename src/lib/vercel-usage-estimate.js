/**
 * Estimates for the two Vercel Hobby allowances that run close to their limits.
 * Vercel does not expose Hobby usage to an app, so these are modeled from what
 * this project knows (its own schedules, its deployments, its active players)
 * and calibrated against Vercel's Usage page. Adjust the constants below when
 * the real numbers drift from the estimate.
 */

export const FLUID_CPU_LIMIT_SECONDS = 4 * 3600;
// Vercel's Functions Storage chart tops out at 10 GB; confirm against the Usage page.
export const FUNCTIONS_STORAGE_LIMIT_BYTES = 10 * 1024 ** 3;

// Seconds of active CPU per invocation, from Vercel Observability on 2026-10-03.
const SCHEDULED_JOBS_PER_DAY = [
  { name: "watchdog", perDay: 144, cpuSeconds: 0.26 },
  { name: "reminder maintenance", perDay: 98, cpuSeconds: 0.29 },
  { name: "score sync", perDay: 144, cpuSeconds: 0.16 },
];
// Uptime probes after CDN caching, measured the same day (about 60 seconds a day).
const HEALTH_PROBE_SECONDS_PER_DAY = 60;
// Calibrated so the model matched Vercel's 4h 0m30s for the 30 days ending 2026-10-02.
const PLAYER_SECONDS_PER_ACTIVE_DAY = 30;
// 10.4 GB of Functions Storage over about 730 Vercel deployments (production and previews).
const FUNCTION_BYTES_PER_DEPLOYMENT = (10.4 * 1024 ** 3) / 730;

export function estimateFluidCpu({ activePlayers, days = 30 }) {
  const backgroundPerDay = SCHEDULED_JOBS_PER_DAY.reduce((sum, job) => sum + job.perDay * job.cpuSeconds, 0) + HEALTH_PROBE_SECONDS_PER_DAY;
  const backgroundSeconds = backgroundPerDay * days;
  const playerSeconds = Math.max(0, activePlayers) * PLAYER_SECONDS_PER_ACTIVE_DAY * days;
  return { seconds: backgroundSeconds + playerSeconds, backgroundSeconds, playerSeconds };
}

export function estimateFunctionsStorageBytes(deployments) {
  return Math.max(0, deployments) * FUNCTION_BYTES_PER_DEPLOYMENT;
}
