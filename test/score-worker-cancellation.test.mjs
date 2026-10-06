import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("scheduled, manual, and watchdog score paths pass the lease signal", async () => {
  const files = [
    "../src/app/api/cron/sync-scores/route.ts",
    "../src/app/api/admin/sync-scores/route.ts",
    "../src/lib/automation-watchdog.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /runWithAutomationLeaseContext\("scores"/);
    assert.match(source, /syncFinalScores\(\{[^}]*signal/);
  }
});

test("the score worker checks the lease after reads and before finalization writes", async () => {
  const source = await readFile(new URL("../src/lib/sync-final-scores.ts", import.meta.url), "utf8");
  assert.match(source, /signal\?\.throwIfAborted\(\);\s*const \{ data: atomicRows/);
  assert.match(source, /finalize_games_atomically[\s\S]*?\);\s*signal\?\.throwIfAborted\(\);/);
  assert.match(source, /\} catch \(error\) \{\s*signal\?\.throwIfAborted\(\);/);
});
