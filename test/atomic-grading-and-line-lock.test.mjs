import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260929010000_atomic_grading_and_line_lock.sql", import.meta.url),
  "utf8",
);
const finalScores = await readFile(new URL("../src/lib/sync-final-scores.ts", import.meta.url), "utf8");
const bowlSync = await readFile(new URL("../src/lib/sync-bowl-pool.ts", import.meta.url), "utf8");
const lineLock = await readFile(new URL("../src/lib/lock-due-lines.ts", import.meta.url), "utf8");

const functions = [
  "recover_pending_ats_grades()",
  "grade_bowl_pool_final_picks(timestamptz)",
  "lock_official_lines_atomically(jsonb, timestamptz)",
];

test("atomic grading and line-lock functions are service-role only", () => {
  for (const signature of functions) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature.replace(/[()]/g, "\\$&")} from public, anon, authenticated;`),
      `${signature} must revoke public access`,
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to service_role;`),
      `${signature} must be callable by the service role`,
    );
  }
  assert.equal((migration.match(/security definer/g) ?? []).length, 3);
  assert.equal((migration.match(/set search_path = public/g) ?? []).length, 3);
});

test("Bowl grading saves the pick and its receipt in one statement and repairs stranded receipts", () => {
  assert.match(migration, /update public\.bowl_pool_picks as pick[\s\S]*?returning pick\.entry_id, pick\.game_id, pick\.result/);
  assert.match(migration, /insert into public\.bowl_pool_game_results[\s\S]*?from updated/);
  assert.match(migration, /Repair receipts stranded by the earlier two-step write/);
  // Bowl PK games are straight up and a tie is a loss; half-point spreads cannot push.
  assert.match(migration, /when locked_spread = 0 then/);
  assert.match(migration, /\) > 0 then 'win'\s+else 'loss'/);
});

test("ATS recovery keeps pushes as losses and never guesses without an official line", () => {
  assert.match(migration, /when favorite_team_id is null\s+or locked_spread is null/);
  assert.match(migration, /\) > 0 then 'win'\s+else 'loss'/);
  assert.match(migration, /and pick\.result = 'pending'\s+and decided\.grade is not null/);
});

test("official line, history snapshot, and audit entry are saved together and audit only real inserts", () => {
  assert.match(migration, /insert into public\.spread_history/);
  assert.match(migration, /insert into public\.game_lines[\s\S]*?on conflict \(game_id\) do nothing\s+returning game_id/);
  assert.match(migration, /insert into public\.audit_logs[\s\S]*?join inserted on inserted\.game_id = incoming\.game_id/);
  assert.match(migration, /'official_line_locked'/);
});

test("the application calls the atomic functions instead of writing step by step", () => {
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

const watchdog = await readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8");
const syncRun = await readFile(new URL("../src/lib/sync-run.ts", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../src/lib/full-schedule-bootstrap.ts", import.meta.url), "utf8");
const reconciliation = await readFile(new URL("../src/lib/full-schedule-reconciliation.ts", import.meta.url), "utf8");

test("run outcomes are recorded through one checked helper that retries and reports", () => {
  assert.match(syncRun, /attempt < 2/);
  assert.match(syncRun, /console\.error\("A sync run outcome could not be recorded\."/);
  for (const [name, source] of [["sync-final-scores", finalScores], ["full-schedule-bootstrap", bootstrap], ["full-schedule-reconciliation", reconciliation], ["automation-watchdog", watchdog]]) {
    assert.match(source, /finishSyncRun\(/, `${name} must use finishSyncRun`);
    assert.doesNotMatch(source, /^\s*await supabaseAdmin\s*\.from\("sync_runs"\)\s*\.update\([\s\S]{0,400}?\)\s*\.eq\("id", run(\.data)?\.id\);/m, `${name} must not ignore run-outcome write errors`);
  }
});

test("a watchdog alert is not sent unless its attempt time was saved", () => {
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

test("the ESPN Bowl sync never replaces a locked official line", () => {
  assert.match(bowlSync, /ignoreDuplicates: true/);
  assert.match(bowlSync, /\.eq\("game_id", saved\.id\)\.is\("locked_at", null\)/);
  assert.doesNotMatch(bowlSync, /bowl_pool_game_lines"\)\.upsert\(\{ game_id: saved\.id/);
});

test("the season year is evaluated on every call, never frozen at module load", async () => {
  const { seasonYearAt } = await import("../src/lib/season.ts");
  assert.equal(seasonYearAt(new Date("2026-08-01T03:59:00Z")), 2025, "before 12:00 AM Eastern on August 1");
  assert.equal(seasonYearAt(new Date("2026-08-01T04:01:00Z")), 2026, "after 12:00 AM Eastern on August 1");
  assert.equal(seasonYearAt(new Date("2027-01-20T12:00:00Z")), 2026, "playoffs belong to the season that began the prior August");
  const season = await readFile(new URL("../src/lib/season.ts", import.meta.url), "utf8");
  assert.doesNotMatch(season, /export const CURRENT_SEASON_YEAR/);
  assert.match(season, /export function currentSeasonYear\(\)/);
});

test("every automation job has one settings row with a timeout shorter than its lease", async () => {
  const source = await readFile(new URL("../src/lib/automation-execution-lease.ts", import.meta.url), "utf8");
  const rows = [...source.matchAll(/^\s+(\w+): \{ leaseSeconds: (\d+), timeoutSeconds: (\d+), label: "([^"]+)" \},$/gm)];
  assert.equal(rows.length, 8);
  for (const [, job, lease, timeout, label] of rows) {
    assert.ok(Number(timeout) < Number(lease), `${job} timeout must be shorter than its lease`);
    assert.ok(label.length > 3);
  }
  const union = source.match(/export type AutomationJob = ([^;]+);/)[1].match(/"(\w+)"/g).map((name) => name.replaceAll('"', ""));
  assert.deepEqual(rows.map((row) => row[1]).sort(), union.sort());
});

const activationMigration = await readFile(new URL("../supabase/migrations/20260929020000_atomic_period_activation.sql", import.meta.url), "utf8");
const advance = await readFile(new URL("../src/lib/advance-scoring-periods.ts", import.meta.url), "utf8");

test("period activation refuses to skip, double-activate, or open an empty period", () => {
  assert.match(activationMigration, /revoke all on function public\.activate_scoring_period_atomically\(uuid, timestamptz\) from public, anon, authenticated;/);
  assert.match(activationMigration, /grant execute on function public\.activate_scoring_period_atomically\(uuid, timestamptz\) to service_role;/);
  assert.match(activationMigration, /pg_advisory_xact_lock\(hashtextextended\(target_period\.season_id::text \|\| ':weekly-handoff', 0\)\)/, "must share the weekly handoff lock");
  for (const reason of ["Another scoring period is already active.", "An earlier scoring period has not been completed.", "cannot activate without an imported schedule", "has not reached its start time"]) {
    assert.ok(activationMigration.includes(reason), `missing guard: ${reason}`);
  }
  assert.match(activationMigration, /'scoring_period_activated'/);
});

test("the application opens the earliest due period through the database and gates rollover on Survivor picks", () => {
  assert.match(advance, /rpc\(\s*"activate_scoring_period_atomically"/);
  assert.doesNotMatch(advance, /\.update\(\{ status: "active" \}\)/);
  assert.match(advance, /\.sort\(\(left, right\) => left\.display_order - right\.display_order\)\[0\]/);
  assert.doesNotMatch(advance, /starts_at[\s\S]{0,200}\.at\(-1\)/, "must never pick the latest due period");
  assert.match(advance, /from\("survivor_picks"\)[\s\S]{0,200}\.eq\("result", "pending"\)/);
  assert.match(advance, /Survivor picks still need a final grade or audited void\./);
});

test("the ESPN Bowl refresh links games and fixes timing but keeps curated names and order", () => {
  assert.match(bowlSync, /function existingGameUpdate/);
  assert.match(bowlSync, /const \{ season_id: _season, bowl_name: _name, order_index: _order, \.\.\.provider \} = row;/);
  assert.match(bowlSync, /update\(existingGameUpdate\(row\)\)/);
  assert.match(bowlSync, /provider_game_id: `espn:\$\{event\.id\}`/, "the ESPN id link is what lets scores match seeded games");
});

test("the retired polling simulator is gone and the real retry ladder is the only policy", async () => {
  const route = await readFile(new URL("../src/app/api/admin/grading-dashboard/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /polling-plan|simulatePollingPlans|recommendPollingPlan/);
  const backoff = await readFile(new URL("../src/lib/score-check-backoff.ts", import.meta.url), "utf8");
  assert.match(backoff, /SCORE_POLLING_RETRY_MINUTES = \[10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240\]/);
});

test("activation takes the per-season lock before locking any period row", async () => {
  const fix = await readFile(new URL("../supabase/migrations/20260929030000_activation_lock_order.sql", import.meta.url), "utf8");
  const lock = fix.indexOf("pg_advisory_xact_lock");
  const rowLock = fix.indexOf("for update;");
  assert.ok(lock > 0 && rowLock > lock, "the advisory lock must come before the period row lock");
  assert.doesNotMatch(fix.slice(0, lock), /for update/);
  assert.match(fix, /grant execute on function public\.activate_scoring_period_atomically\(uuid, timestamptz\) to service_role;/);
});

test("a Bowl game already linked to its ESPN event stays on the protected update path", () => {
  assert.match(bowlSync, /candidate\.provider_game_id === `espn:\$\{event\.id\}`/);
  assert.match(bowlSync, /const gameId = matched\?\.id;/);
  assert.match(bowlSync, /matched\.kickoff_at !== kickoff/);
});
