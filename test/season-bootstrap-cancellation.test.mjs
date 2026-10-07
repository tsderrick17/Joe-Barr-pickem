import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("scheduled and Commissioner bootstrap paths pass the shared lease signal", async () => {
  const paths = [
    "../src/app/api/cron/bootstrap-season/route.ts",
    "../src/app/api/admin/import-full-schedule/route.ts",
    "../src/app/api/admin/season-bootstrap-status/route.ts",
  ];
  for (const path of paths) {
    const source = await read(path);
    assert.match(source, /runWithAutomationLeaseContext\("season_bootstrap", \(\{ signal \}\) => bootstrapFullSchedule\(\{(?: automatic: true,)? signal \}\)\)/);
  }
  const cron = await read(paths[0]);
  assert.match(cron, /request\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`/);
});

test("schedule preparation cancels the provider read and stops before later preparation work", async () => {
  const source = await read("../src/lib/full-schedule-bootstrap.ts");
  assert.match(source, /const timeout = AbortSignal\.timeout\(30_000\);\s*response = await fetch\(sourceUrl, \{ cache: "no-store", signal: signal \? AbortSignal\.any\(\[signal, timeout\]\) : timeout \}\)/);
  assert.match(source, /catch \{\s*signal\?\.throwIfAborted\(\);\s*throw new Error\("The full-season schedule provider could not be reached\."\)/);
  assert.match(source, /await response\.text\(\);[\s\S]*?signal\?\.throwIfAborted\(\);\s*const games = parseNflverseRegularSeason/);
  assert.match(source, /signal\?\.throwIfAborted\(\);\s*const \{ error: extendError \} = await supabaseAdmin\.rpc\("ensure_regular_season_weeks"[\s\S]*?\);\s*signal\?\.throwIfAborted\(\)/);
});

test("cancellation before atomic import records failure; after it starts, the result is allowed to settle", async () => {
  const source = await read("../src/lib/full-schedule-bootstrap.ts");
  assert.match(source, /const prepared = await prepareFullSchedule\(now, signal\);\s*signal\?\.throwIfAborted\(\);[\s\S]*?const \{ data, error \} = await supabaseAdmin\.rpc\("import_full_schedule_atomically"/);
  const importStart = source.indexOf('supabaseAdmin.rpc("import_full_schedule_atomically"');
  const receipt = source.indexOf("finishSyncRun(run.id, { status: \"success\"", importStart);
  assert.ok(importStart >= 0 && receipt > importStart);
  assert.doesNotMatch(source.slice(importStart, receipt), /signal\?\.throwIfAborted\(\)/);
  assert.match(source, /catch \(error\) \{[\s\S]*?await finishSyncRun\(run\.id, \{\s*status: waiting \? "success" : "failed"/);
});

test("annual rollover observes cancellation between its atomic phases", async () => {
  const [rollover, scoreWorker] = await Promise.all([
    read("../src/lib/season-rollover.ts"),
    read("../src/lib/sync-final-scores.ts"),
  ]);
  assert.match(rollover, /signal\?\.throwIfAborted\(\);\s*const \{ error: rolloverError \} = await supabaseAdmin\.rpc\("ensure_annual_season_rollover"[\s\S]*?\);\s*signal\?\.throwIfAborted\(\);[\s\S]*?signal\?\.throwIfAborted\(\);\s*const \{ data, error: turnoverError \} = await supabaseAdmin\.rpc\([\s\S]*?"perform_annual_season_turnover"/);
  assert.match(scoreWorker, /ensureAnnualSeasonRollover\(checkedAt, signal\)/);
});
