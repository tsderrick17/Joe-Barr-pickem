import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("account capacity gauges use existing provider records and database details stay commissioner-only", async () => {
  const [capacity, route, migration, guardrails, panel] = await Promise.all([
    readFile(new URL("../src/lib/account-capacity.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/account-capacity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819010000_add_account_capacity_measurement.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819020000_add_storage_guardrails.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/components/account-capacity.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(capacity, /email_reminder_deliveries/);
  assert.match(capacity, /sync_runs/);
  assert.doesNotMatch(capacity, /api\.the-odds-api\.com/);
  assert.match(route, /requireCommissioner/);
  assert.match(migration, /pg_database_size/);
  assert.match(migration, /revoke all.*from public, anon, authenticated/i);
  assert.match(panel, /Awaiting connection/);
  assert.match(panel, /never shown as zero/);
  assert.match(capacity, /storage_table_usage/);
  assert.match(route, /storageTables/);
  assert.match(guardrails, /skip_duplicate_preliminary_spread_snapshot/);
  assert.match(guardrails, /prune_operational_storage/);
  assert.match(guardrails, /180 days/);
  assert.match(guardrails, /cron\.schedule/);
  assert.match(guardrails, /revoke all.*storage_table_usage.*from public, anon, authenticated/i);
  assert.match(panel, /See what uses database space/);
});
