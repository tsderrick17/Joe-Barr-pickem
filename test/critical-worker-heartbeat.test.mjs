import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assessCriticalWorkerHeartbeats } from "../src/lib/critical-worker-heartbeat.js";

const now = new Date("2026-09-13T16:00:00Z");

test("critical worker heartbeat requires recent line, score, and reminder successes", () => {
  const result = assessCriticalWorkerHeartbeats([
    { job_name: "line_locks", last_succeeded_at: "2026-09-13T15:58:00Z", last_failed_at: null },
    { job_name: "scores", last_succeeded_at: "2026-09-13T15:30:00Z", last_failed_at: null },
    { job_name: "reminders", last_succeeded_at: "2026-09-13T15:50:00Z", last_failed_at: null },
  ], now);
  assert.deepEqual(result, { healthy: true, problems: [] });
});

test("critical worker heartbeat fails closed for missing, stale, or later failed workers", () => {
  const result = assessCriticalWorkerHeartbeats([
    { job_name: "line_locks", last_succeeded_at: "2026-09-13T15:58:00Z", last_failed_at: "2026-09-13T15:59:00Z" },
    { job_name: "scores", last_succeeded_at: "2026-09-13T15:20:00Z", last_failed_at: null },
  ], now);
  assert.deepEqual(result, { healthy: false, problems: [
    { jobName: "line_locks", reason: "failed" },
    { jobName: "scores", reason: "stale" },
    { jobName: "reminders", reason: "missing" },
  ] });
});

test("worker receipts stay constant-size and the public route remains opaque", async () => {
  const [migration, lease, route, backup] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260820011000_add_critical_worker_heartbeats.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/automation-execution-lease.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/health/workers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/database-backup.yml", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /job_name text primary key/);
  assert.match(migration, /on conflict \(job_name\) do update/);
  assert.match(migration, /revoke all.*public, anon, authenticated/is);
  assert.match(lease, /recordAutomationWorkerHeartbeat\(job, "started"\)/);
  assert.match(lease, /recordAutomationWorkerHeartbeat\(job, "success"\)/);
  assert.match(lease, /recordAutomationWorkerHeartbeat\(job, "failed"\)/);
  assert.match(route, /status: result\.healthy \? 200 : 503/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*(job_name|last_succeeded_at|problems)/s);
  assert.match(backup, /UPTIMEROBOT_BACKUP_HEARTBEAT_URL/);
  assert.match(backup, /curl --fail/);
});
