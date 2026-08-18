import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20260818013000_rebuild_critical_automation.sql", import.meta.url);

test("one idempotent migration recreates every game-critical schedule", async () => {
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

