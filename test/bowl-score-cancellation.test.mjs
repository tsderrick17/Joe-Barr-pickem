import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the scheduled Bowl score route passes the lease signal into the worker", async () => {
  const route = await readFile(new URL("../src/app/api/cron/sync-bowl-scores/route.ts", import.meta.url), "utf8");
  assert.match(route, /runWithAutomationLeaseContext\("bowl_scores", \(\{ signal \}\) => syncBowlPool\(new Date\(\), signal\)\)/);
  assert.match(route, /request\.headers\.get\("authorization"\) !== `Bearer \$\{cronSecret\}`/);
});

test("Bowl provider requests combine the lease cancellation signal with a bounded timeout", async () => {
  const source = await readFile(new URL("../src/lib/sync-bowl-pool.ts", import.meta.url), "utf8");
  assert.match(source, /function requestSignal\(signal\?: AbortSignal\)[\s\S]*?AbortSignal\.timeout\(12_000\)[\s\S]*?AbortSignal\.any\(\[signal, timeout\]\)/);
  assert.match(source, /async function providerEvents\([\s\S]*?signal\?: AbortSignal\)[\s\S]*?signal: requestSignal\(signal\)/);
  assert.match(source, /catch\(\(\) => \{ checkExecution\(signal\); return null; \}\)/);
});

test("Bowl sync observes cancellation between refresh stages and inside per-game loops", async () => {
  const source = await readFile(new URL("../src/lib/sync-bowl-pool.ts", import.meta.url), "utf8");
  assert.match(source, /syncAnnualSchedule\(now, signal\)[\s\S]*?checkExecution\(signal\);\s*const provider = await syncScheduleAndLines\(now, signal\)[\s\S]*?checkExecution\(signal\);\s*const finalizedGames = await syncScores\(now, signal\)/);
  assert.match(source, /for \(const event of events[\s\S]*?\{\s*checkExecution\(signal\);/);
  assert.match(source, /for \(const game of games\) \{\s*checkExecution\(signal\);/);
  assert.match(source, /teamIdFor\(name, `espn:\$\{id\}`,[\s\S]*?signal\)/);
});

test("atomic Bowl settlement calls finish before cancellation prevents later stages", async () => {
  const source = await readFile(new URL("../src/lib/sync-bowl-pool.ts", import.meta.url), "utf8");
  assert.match(source, /checkExecution\(signal\);\s*const \{ data: missing, error: missingError \} = await supabaseAdmin\.rpc\("settle_bowl_pool_missing_picks"[\s\S]*?\);\s*checkExecution\(signal\);/);
  assert.match(source, /checkExecution\(signal\);\s*const \{ data: gradedCount, error: gradeError \} = await supabaseAdmin\.rpc\("grade_bowl_pool_final_picks"[\s\S]*?\);\s*checkExecution\(signal\);/);
  assert.doesNotMatch(source, /rpc\("(?:settle_bowl_pool_missing_picks|purge_withdrawn_bowl_pool_drafts|grade_bowl_pool_final_picks|refresh_bowl_pool_champion)"[^;]*signal/);
});
