import assert from "node:assert/strict";
import test from "node:test";
import { latestWorkerRuns } from "../src/lib/latest-worker-runs.js";

test("worker activity keeps the newest invocation when database results are descending", () => {
  const runs = [
    { job_type: "scores", started_at: "2026-09-28T15:00:00Z", status: "success" },
    { job_type: "line_locks", started_at: "2026-09-28T14:00:00Z", status: "success" },
    { job_type: "scores", started_at: "2026-09-08T04:00:00Z", status: "success" },
  ];
  assert.deepEqual(latestWorkerRuns(runs).map((run) => [run.job_type, run.started_at]), [
    ["scores", "2026-09-28T15:00:00Z"],
    ["line_locks", "2026-09-28T14:00:00Z"],
  ]);
});

test("worker activity ignores invalid timestamps and keeps the later row on a timestamp tie", () => {
  const runs = [
    { job_type: "scores", started_at: "2026-09-28T15:00:00Z", status: "failed" },
    { job_type: "scores", started_at: "invalid", status: "success" },
    { job_type: "scores", started_at: "2026-09-28T15:00:00Z", status: "success" },
  ];
  assert.deepEqual(latestWorkerRuns(runs), [runs[2]]);
});
