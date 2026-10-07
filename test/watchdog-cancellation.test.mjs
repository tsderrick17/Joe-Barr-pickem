import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [cronRoute, adminRoute, watchdog] = await Promise.all([
  readFile(new URL("../src/app/api/cron/watchdog/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/admin/watchdog/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8"),
]);

test("both watchdog entry points pass their lease timeout signal into the worker", () => {
  for (const [name, route] of [["cron", cronRoute], ["Commissioner", adminRoute]]) {
    assert.match(route, /runWithAutomationLeaseContext\("watchdog",\s*\(\{ signal \}\) => runAutomationWatchdog\(new Date\(\), signal\)\)\)/, `${name} watchdog must pass the lease signal`);
    assert.doesNotMatch(route, /runWithAutomationLease\("watchdog"/);
  }
});

test("watchdog cancellation stops subsequent diagnostics and recovery while preserving child leases", () => {
  assert.match(watchdog, /runAutomationWatchdog\(now = new Date\(\), executionSignal\?: AbortSignal\)/);
  assert.match(watchdog, /executionSignal\?\.throwIfAborted\(\);\s+const \[initialHealth, bootstrap/);
  assert.match(watchdog, /await recoverCriticalWorkerWork\(initialHealth, executionSignal\);\s+executionSignal\?\.throwIfAborted\(\);/);
  assert.match(watchdog, /AbortSignal\.any\(\[signal, executionSignal\]\)/);
  assert.match(watchdog, /for \(const signal of signals\) \{\s+executionSignal\?\.throwIfAborted\(\);/);
  assert.match(watchdog, /Once the attempt receipt is durable, do not insert a cancellation/);
});
