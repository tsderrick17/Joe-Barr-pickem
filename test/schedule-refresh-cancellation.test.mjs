import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Commissioner schedule refresh passes the shared schedule lease signal", async () => {
  const source = await read("../src/app/api/admin/import-games/route.ts");
  assert.match(source, /runWithAutomationLeaseContext\("schedule_refresh", \(\{ signal \}\) =>\s*refreshSchedule\(\{ oddsApiKey, isAutomation, signal \}\)/);
  assert.match(source, /signal\.throwIfAborted\(\);[\s\S]*?reconcileFullSeasonSchedule\(new Date\(\), signal\)/);
});

test("the Odds API request is cancellable and cancellation is not recorded as provider failure", async () => {
  const source = await read("../src/app/api/admin/import-games/route.ts");
  assert.match(source, /const timeout = AbortSignal\.timeout\(20_000\);[\s\S]*?signal: AbortSignal\.any\(\[signal, timeout\]\)/);
  assert.match(source, /catch \(error\) \{\s*signal\.throwIfAborted\(\);\s*const cooldown = await recordScheduleProviderFailure\(error\)/);
  assert.match(source, /const payload: unknown = await oddsResponse\.json\(\);\s*if \(!Array\.isArray\(payload\)\)/);
});

test("full-season reconciliation cancels provider work and checks before its atomic write", async () => {
  const source = await read("../src/lib/full-schedule-reconciliation.ts");
  assert.match(source, /reconcileFullSeasonSchedule\(now = new Date\(\), signal\?: AbortSignal\)/);
  assert.match(source, /const timeout = AbortSignal\.timeout\(30_000\);[\s\S]*?signal \? AbortSignal\.any\(\[signal, timeout\]\) : timeout/);
  assert.match(source, /signal\?\.throwIfAborted\(\);\s*const \{ data, error \} = await supabaseAdmin\.rpc\("reconcile_full_schedule_atomically"/);
  const atomicStart = source.indexOf('supabaseAdmin.rpc("reconcile_full_schedule_atomically"');
  const successReceipt = source.indexOf('finishSyncRun(run.id, { status: "success"', atomicStart);
  assert.ok(atomicStart >= 0 && successReceipt > atomicStart);
  assert.doesNotMatch(source.slice(atomicStart, successReceipt), /signal\?\.throwIfAborted\(\)/);
});

test("the Odds API usage receipt is saved before cancellation can stop the main atomic import", async () => {
  const source = await read("../src/app/api/admin/import-games/route.ts");
  const usageReceipt = source.indexOf('provider: "The Odds API"');
  const atomicImport = source.indexOf('supabaseAdmin.rpc(\n    "import_schedule_atomically"');
  assert.ok(usageReceipt >= 0 && atomicImport > usageReceipt);
  assert.match(source.slice(usageReceipt, atomicImport), /await clearScheduleProviderCircuit\(\);\s*signal\.throwIfAborted\(\)/);
  assert.match(source, /signal\.throwIfAborted\(\);\s*\/\/ The schedule, period assignments, and lines commit atomically\.[\s\S]*?supabaseAdmin\.rpc\([\s\S]*?"import_schedule_atomically"/);
});
