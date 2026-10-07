/**
 * @typedef {Object} WorkerRun
 * @property {string} job_type
 * @property {string} started_at
 * @property {string | null} completed_at
 * @property {string} status
 * @property {string | null} error_message
 */

/** Return the newest recorded invocation for each worker, regardless of input order.
 * Invalid timestamps are ignored; ties prefer the later row in the supplied list.
 * @param {WorkerRun[] | null | undefined} runs
 * @returns {WorkerRun[]}
 */
export function latestWorkerRuns(runs) {
  const latest = new Map();
  for (const run of runs ?? []) {
    const current = latest.get(run.job_type);
    const timestamp = Date.parse(run.started_at);
    const currentTimestamp = current ? Date.parse(current.started_at) : Number.NEGATIVE_INFINITY;
    if (Number.isFinite(timestamp) && timestamp >= currentTimestamp) latest.set(run.job_type, run);
  }
  return [...latest.values()].sort((left, right) => Date.parse(right.started_at) - Date.parse(left.started_at));
}
