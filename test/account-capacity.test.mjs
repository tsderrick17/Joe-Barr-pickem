import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("account capacity gauges use existing provider records and never expose a public database measurement", async () => {
  const [capacity, route, migration, panel] = await Promise.all([
    readFile(new URL("../src/lib/account-capacity.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/account-capacity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819010000_add_account_capacity_measurement.sql", import.meta.url), "utf8"),
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
});
