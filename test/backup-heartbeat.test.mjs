import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assessBackupWorkflowRun } from "../src/lib/backup-heartbeat.js";

const now = new Date("2026-09-21T17:00:00Z");

test("backup heartbeat accepts a recent completed restore-verified workflow", () => {
  const result = assessBackupWorkflowRun({
    status: "completed",
    conclusion: "success",
    updated_at: "2026-09-21T13:30:00Z",
  }, now);
  assert.deepEqual(result, { healthy: true, reason: "current", ageSeconds: 12_600 });
});

test("backup heartbeat fails closed for failed, stale, missing, or malformed runs", () => {
  assert.equal(assessBackupWorkflowRun({ status: "completed", conclusion: "failure", updated_at: now.toISOString() }, now).healthy, false);
  assert.equal(assessBackupWorkflowRun({ status: "completed", conclusion: "success", updated_at: "2026-09-14T12:59:59Z" }, now).healthy, false);
  assert.deepEqual(assessBackupWorkflowRun(null, now), { healthy: false, reason: "missing" });
  assert.deepEqual(assessBackupWorkflowRun({ status: "completed", conclusion: "success", updated_at: "bad" }, now), { healthy: false, reason: "invalid" });
});

test("free backup monitoring uses an opaque HTTP endpoint and no paid push heartbeat", async () => {
  const [route, workflow] = await Promise.all([
    readFile(new URL("../src/app/api/health/backup/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/database-backup.yml", import.meta.url), "utf8"),
  ]);
  assert.match(route, /GITHUB_USAGE_TOKEN/);
  assert.match(route, /actions\/workflows\/database-backup\.yml\/runs/);
  assert.match(route, /status: heartbeat\.healthy \? 200 : 503/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*(workflow_runs|conclusion|updated_at|token)/s);
  assert.doesNotMatch(workflow, /UPTIMEROBOT_BACKUP_HEARTBEAT_URL/);
});
