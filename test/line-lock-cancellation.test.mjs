import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("scheduled, Commissioner, and watchdog line-lock paths pass the lease signal", async () => {
  for (const path of [
    "../src/app/api/cron/lock-lines/route.ts",
    "../src/app/api/admin/lock-lines/route.ts",
    "../src/lib/automation-watchdog.ts",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, path.includes("watchdog")
      ? /runWithAutomationLeaseContext\("line_locks", \(\{ signal \}\) =>\s*lockDueLines\(new Date\(\), executionSignal \? AbortSignal\.any\(\[signal, executionSignal\]\) : signal\)/
      : /runWithAutomationLeaseContext\("line_locks", \(\{ signal \}\) =>\s*lockDueLines\(new Date\(\), signal\)/,
    `${path} must pass the lease signal to the line-lock worker`);
  }
});

test("the line-lock worker checks cancellation before atomic writes", async () => {
  const source = await readFile(new URL("../src/lib/lock-due-lines.ts", import.meta.url), "utf8");
  assert.match(source, /await voidDisruptedPicks\(\);\s*signal\?\.throwIfAborted\(\)/);
  assert.match(source, /fetchLineLockProviderEvents\(configuredOddsApiKey, fetch, signal\)/);
  assert.match(source, /if \(decisions\.length > 0\) \{[\s\S]{0,200}?signal\?\.throwIfAborted\(\)/);
  assert.match(source, /signal\?\.throwIfAborted\(\);\s*const \{ error: runError \}/);
  assert.match(source, /catch \(error\) \{\s*signal\?\.throwIfAborted\(\)/);
});
