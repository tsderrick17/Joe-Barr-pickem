import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assessAutomationHeartbeat, assessAutomationWorkerHeartbeat } from "../src/lib/automation-heartbeat.js";

const now = new Date("2026-09-13T16:00:00Z");

test("automation heartbeat accepts a recent successful watchdog receipt", () => {
  const result = assessAutomationHeartbeat({ status: "success", started_at: "2026-09-13T15:54:00Z", completed_at: "2026-09-13T15:55:00Z" }, now);
  assert.deepEqual(result, { healthy: true, reason: "current", ageSeconds: 300 });
});

test("automation heartbeat fails closed for stale, failed, missing, or malformed receipts", () => {
  assert.equal(assessAutomationHeartbeat({ status: "success", completed_at: "2026-09-13T15:39:59Z" }, now).healthy, false);
  assert.deepEqual(assessAutomationHeartbeat({ status: "failed", completed_at: "2026-09-13T15:59:00Z" }, now), { healthy: false, reason: "failed" });
  assert.deepEqual(assessAutomationHeartbeat(null, now), { healthy: false, reason: "missing" });
  assert.deepEqual(assessAutomationHeartbeat({ status: "success", completed_at: "not-a-date" }, now), { healthy: false, reason: "invalid" });
});

test("worker heartbeat stays current through an older diagnostic failure", () => {
  const result = assessAutomationWorkerHeartbeat({
    last_succeeded_at: "2026-09-13T15:55:00Z",
    last_failed_at: "2026-09-13T15:50:00Z",
  }, now);
  assert.deepEqual(result, { healthy: true, reason: "current", ageSeconds: 300 });
  assert.equal(assessAutomationWorkerHeartbeat({
    last_succeeded_at: "2026-09-13T15:55:00Z",
    last_failed_at: "2026-09-13T15:59:00Z",
  }, now).healthy, true);
});

test("automation heartbeat allows a delayed watchdog delivery within the grace window", () => {
  const result = assessAutomationHeartbeat({ status: "success", completed_at: "2026-09-13T15:45:00Z" }, now);
  assert.equal(result.healthy, true);
});

test("watchdog records liveness before noncritical diagnostics", async () => {
  const source = await readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8");
  const runReceipt = source.indexOf('insert({ provider: "internal", job_type: "watchdog", status: "started" })');
  const pulse = source.indexOf('recordAutomationWorkerHeartbeat("watchdog", "success")');
  const diagnostics = source.indexOf("const [initialHealth, bootstrap, preflight");
  assert.ok(runReceipt >= 0);
  assert.ok(pulse > runReceipt);
  assert.ok(diagnostics > pulse);
});

test("public automation health route exposes only an opaque monitor response", async () => {
  const source = await readFile(new URL("../src/app/api/health/automation/route.ts", import.meta.url), "utf8");
  assert.match(source, /automation_worker_heartbeats/);
  assert.match(source, /status:\s*heartbeat\.healthy \? 200 : 503/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*(error|data|started_at|completed_at)/s);
});

