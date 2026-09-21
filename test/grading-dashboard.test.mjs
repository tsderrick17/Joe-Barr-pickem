import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("grading dashboard exposes a game pipeline and actionable attention queue", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/grading-dashboard.tsx", import.meta.url), "utf8");

  assert.match(route, /needs_review/);
  assert.match(route, /lastScoreSyncAgeMinutes/);
  assert.match(route, /watchdog\.openAlerts/);
  assert.match(route, /audit_logs/);
  assert.match(route, /pick grades are still pending/);
  assert.match(component, /GRADING CONTROL CENTER/);
  assert.match(component, /Game pipeline/);
  assert.match(component, /Attention queue/);
  assert.match(component, /Recent operational history/);
  assert.match(component, /Participant impact/);
  assert.match(component, /Notification readiness/);
  assert.match(component, /Release readiness/);
  assert.match(component, /Provider efficiency/);
  assert.match(route, /summarizeProviderEfficiency/);
  assert.match(route, /periodId/);
  assert.match(component, /aria-labelledby="grading-dashboard-title"/);
  assert.match(component, /grading-period/);
  assert.match(component, /Worker activity/);
  assert.match(route, /workerRuns/);
  assert.match(component, /GAME INSPECTOR/);
  assert.match(component, /Copy snapshot/);
  assert.match(component, /Incident posture/);
  assert.match(route, /recentAlerts/);
  assert.match(route, /settlementLatency/);
  assert.match(component, /Settlement latency/);
  assert.match(component, /Period comparison/);
  assert.match(route, /previousAverageMinutes/);
});

test("grading dashboard keeps the current scoring period and reminder signals together", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /displayName: period\.display_name/);
  assert.match(route, /reminders:/);
  assert.match(route, /providerAllowance/);
});
