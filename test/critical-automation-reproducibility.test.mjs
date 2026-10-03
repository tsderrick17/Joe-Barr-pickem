import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20260818013000_rebuild_critical_automation.sql", import.meta.url);

// The isolated season drill strips the production schedules from this migration
// before running the suite, so the schedule assertions only apply to the
// committed file.
const isolatedCopy = (await readFile(migrationUrl, "utf8")).includes("Isolated test databases never schedule requests to the live deployment.");

test("one idempotent migration recreates every game-critical schedule", { skip: isolatedCopy && "migration was rewritten for the isolated database" }, async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const expected = [
    ["lock-official-lines-every-minute", "* * * * *", "/api/cron/lock-lines"],
    ["refresh-final-nfl-scores-every-15-minutes", "*/15 * * * *", "/api/cron/sync-scores"],
    ["refresh-nfl-schedule-and-spreads-prelock-early", "0 11 * 1,2,8,9,10,11,12 *", "/api/admin/import-games"],
    ["refresh-nfl-schedule-and-spreads-prelock-standard", "0 12 * 1,2,8,9,10,11,12 *", "/api/admin/import-games"],
  ];
  for (const [name, cadence, endpoint] of expected) {
    assert.ok(sql.includes(name));
    assert.ok(sql.includes(`'${cadence}'`), `${name} must retain its exact cadence`);
    assert.ok(sql.includes(endpoint), `${name} must retain its endpoint`);
  }
  assert.match(sql, /cron\.unschedule/);
  assert.match(sql, /Authorization/);
  assert.match(sql, /cron_secret/);
});

test("Automation Preflight verifies definitions and deployment-to-Vault authorization", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /schedule = required_jobs\.expected_schedule/);
  assert.match(sql, /command like '%' \|\| required_jobs\.expected_path \|\| '%'/);
  assert.match(sql, /command like '%Authorization%'/);
  assert.match(sql, /automation_cron_secret_matches\(candidate_secret text\)/);
  assert.match(sql, /grant execute on function public\.automation_cron_secret_matches\(text\) to service_role/);
});

test("isolated rehearsal strips only live schedules and retains preflight functions", async () => {
  const source = await readFile(new URL("../scripts/prepare-isolated-schema.mjs", import.meta.url), "utf8");
  assert.match(source, /20260818013000_rebuild_critical_automation\.sql/);
  assert.match(source, /BEGIN PRODUCTION CRITICAL SCHEDULES/);
  assert.match(source, /END PRODUCTION CRITICAL SCHEDULES/);
  assert.match(source, /stricter preflight functions/);
});

test("minute line-lock gate preserves disrupted-pick voiding before skipping Vercel", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260928020000_reduce_automation_dispatch_work.sql", import.meta.url), "utf8");
  assert.match(sql, /public\.dispatch_line_lock_if_due\(\)/);
  assert.match(sql, /public\.line_lock_work_is_due\(\)/);
  assert.match(sql, /game\.line_lock_at <= statement_timestamp\(\)/);
  assert.match(sql, /public\.picks pick[\s\S]*game\.status in \('postponed', 'cancelled', 'no_contest'\)/);
  assert.match(sql, /public\.survivor_picks pick[\s\S]*game\.status in \('postponed', 'cancelled', 'no_contest'\)/);
  assert.match(sql, /if not public\.line_lock_work_is_due\(\) then return false; end if;[\s\S]*net\.http_post/);
});

test("reminder delivery calls Vercel only when the claim would find work", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260929070000_gate_reminder_dispatch.sql", import.meta.url), "utf8");
  // Mirrors claim_due_push_reminders(): due scheduled rows and stale claims.
  assert.match(sql, /reminder\.status = 'scheduled'\s+and reminder\.scheduled_for <= clock_timestamp\(\)/);
  assert.match(sql, /reminder\.status = 'sending'\s+and reminder\.processing_started_at < clock_timestamp\(\) - interval '20 minutes'/);
  assert.match(sql, /if not public\.reminder_delivery_is_due\(\) then return false; end if;[\s\S]*\/api\/cron\/send-reminders/);
  assert.match(sql, /cron\.schedule\('send-pickem-browser-reminders-every-five-minutes', '\*\/5 \* \* \* \*', 'select public\.dispatch_reminders_if_due\(\);'\)/);
  assert.match(sql, /'send-pickem-browser-reminders-every-five-minutes', 'Reminder delivery: gated every five minutes', '\*\/5 \* \* \* \*', 'dispatch_reminders_if_due', 'dispatch_reminders_if_due'/);
  assert.match(sql, /to_regprocedure\('cron\.schedule\(text,text,text\)'\) is not null/);
});

test("five-minute reminder delivery no longer reconciles future schedules", async () => {
  const [worker, maintenance, route, migration] = await Promise.all([
    readFile(new URL("../src/lib/reminder-worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/automatic-reminder-maintenance.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/cron/maintain-reminders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260928020000_reduce_automation_dispatch_work.sql", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(worker, /ensureAutomaticEmailPlanMessages|ensureAutomaticWeeklyRecap|ensureAutomaticBowlPoolEmails/);
  assert.match(maintenance, /ensureAutomaticEmailPlanMessages\(\)/);
  assert.match(maintenance, /ensureAutomaticWeeklyRecap\(\)/);
  assert.match(maintenance, /ensureAutomaticBowlPoolEmails\(\)/);
  assert.match(route, /runWithAutomationLease\("reminder_schedule"/);
  assert.match(migration, /reconcile-pickem-email-schedule-every-fifteen-minutes/);
});

