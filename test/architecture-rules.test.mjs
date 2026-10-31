import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Rules about how the code is put together, checked by reading it. These are lint-style on purpose: each says something that must hold for every
// route or module of a kind, which no single behavior test can show. A test of what a function DOES belongs beside that function and runs it.
// (AGENTS.md: never match the text of the stylesheet or of a component's markup; add a screenshot state instead.)
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Season Snapshot route checks sign-in before it reads anything, and reports the sign-in failure's own status", async () => {
  const route = await source("src/app/api/season-snapshot/route.ts");
  assert.ok(route.indexOf("authenticateActivePlayer(request)") >= 0 && route.indexOf("authenticateActivePlayer(request)") < route.indexOf("loadSeasonSnapshot("));
  assert.match(route, /status: access\.status/);
});

test("the browser's Sentry events pass through the shared filter before they are sent", async () => {
  assert.match(await source("instrumentation-client.ts"), /beforeSend:\s*prepareBrowserSentryEvent/);
});

test("the server credential is the service-role key first, the secret key only as a named fallback, and launch preflight rejects the fallback", async () => {
  const admin = await source("src/lib/supabase-admin.ts");
  const preflight = await source("src/lib/launch-preflight.ts");
  assert.ok(admin.indexOf("SUPABASE_SERVICE_ROLE_KEY") < admin.indexOf("SUPABASE_SECRET_KEY"));
  assert.match(admin, /supabaseServerCredentialSource/);
  assert.match(admin, /supabaseServerCredentialUsesFallback/);
  assert.match(preflight, /authorized && authoritativeSource/);
  assert.match(preflight, /compatibility fallback/);
});

// ---- Atomic writes, recorded outcomes and the Bowl sync's protected paths (moved from atomic-grading-and-line-lock.test.mjs)
const AUTOMATION_FILES = { finalScores: "sync-final-scores", bowlSync: "sync-bowl-pool", lineLock: "lock-due-lines", watchdog: "automation-watchdog", syncRun: "sync-run", bootstrap: "full-schedule-bootstrap", reconciliation: "full-schedule-reconciliation" };
const automationSources = Promise.all(Object.entries(AUTOMATION_FILES).map(async ([name, file]) => [name, await source(`src/lib/${file}.ts`)])).then(Object.fromEntries);

test("the application calls the atomic functions instead of writing step by step", async () => {
  const { finalScores, bowlSync, lineLock } = await automationSources;
  assert.match(finalScores, /rpc\("recover_pending_ats_grades"\)/);
  assert.doesNotMatch(finalScores, /from\("picks"\)\s*\.update\(\{ result \}\)/);
  assert.doesNotMatch(finalScores, /gradeAtsPick/);

  assert.match(bowlSync, /rpc\("grade_bowl_pool_final_picks"/);
  assert.doesNotMatch(bowlSync, /from\("bowl_pool_picks"\)\.update\(\{ result/);
  assert.doesNotMatch(bowlSync, /from\("bowl_pool_game_results"\)\.upsert/);
  assert.doesNotMatch(bowlSync, /getUTCMonth\(\) >= 7/, "Bowl sync must use the shared Eastern season year");

  assert.match(lineLock, /rpc\(\s*"lock_official_lines_atomically"/);
  assert.doesNotMatch(lineLock, /from\("game_lines"\)\s*\.(upsert|insert|update)/);
  assert.doesNotMatch(lineLock, /from\("spread_history"\)\s*\.insert/);
  assert.doesNotMatch(lineLock, /from\("audit_logs"\)\s*\.insert/);
  assert.match(lineLock, /throw new Error\("The official game lines could not be saved\."\)/);
});


test("run outcomes are recorded through one checked helper that retries and reports", async () => {
  const { finalScores, watchdog, syncRun, bootstrap, reconciliation } = await automationSources;
  assert.match(syncRun, /attempt < 2/);
  assert.match(syncRun, /console\.error\("A sync run outcome could not be recorded\."/);
  for (const [name, source] of [["sync-final-scores", finalScores], ["full-schedule-bootstrap", bootstrap], ["full-schedule-reconciliation", reconciliation], ["automation-watchdog", watchdog]]) {
    assert.match(source, /finishSyncRun\(/, `${name} must use finishSyncRun`);
    assert.doesNotMatch(source, /^\s*await supabaseAdmin\s*\.from\("sync_runs"\)\s*\.update\([\s\S]{0,400}?\)\s*\.eq\("id", run(\.data)?\.id\);/m, `${name} must not ignore run-outcome write errors`);
  }
});


test("a watchdog alert is not sent unless its attempt time was saved", async () => {
  const { watchdog } = await automationSources;
  const attempt = watchdog.indexOf("notification_attempted_at: now.toISOString()");
  const guard = watchdog.indexOf("so the alert was not sent");
  const send = watchdog.indexOf("await notifyCommissioners(signal)");
  assert.ok(attempt > 0 && guard > attempt && send > guard, "attempt must be saved and checked before sending");
  // A failed write on one incident is counted and skipped, never thrown, so one bad
  // row cannot stop every other incident from being opened or sent.
  assert.match(watchdog, /bookkeepingFailures \+= 1;/);
  assert.match(watchdog, /Recovered watchdog incidents could not be closed/);
  assert.match(watchdog, /An open watchdog incident could not be refreshed/);
  assert.doesNotMatch(watchdog, /throw new Error\("(Recovered watchdog incidents could not be closed|An open watchdog incident could not be refreshed|A watchdog alert attempt could not be recorded)/);
  assert.match(watchdog, /bookkeepingFailures,\s+criticalWorkerRecovery/);
});


// The ESPN Bowl schedule pull's rules (a locked line is never replaced, curated names and order are kept, a linked game follows ESPN) are behaviour tests in
// bowl-schedule-sync.test.mjs and bowl-pool-espn-schedule.test.mjs.
