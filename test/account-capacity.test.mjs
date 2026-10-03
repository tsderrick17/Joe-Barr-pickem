import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("account capacity gauges use existing provider records and database details stay commissioner-only", async () => {
  const [capacity, route, migration, guardrails, panel, watchdog] = await Promise.all([
    readFile(new URL("../src/lib/account-capacity.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/account-capacity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819010000_add_account_capacity_measurement.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260819020000_add_storage_guardrails.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/components/account-capacity.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8"),
  ]);

  assert.match(capacity, /email_reminder_deliveries/);
  assert.match(capacity, /sync_runs/);
  assert.match(capacity, /summarizeProviderEfficiency/);
  assert.match(capacity, /monthlyCreditSeries/);
  assert.match(capacity, /efficiencyStart/);
  assert.doesNotMatch(capacity, /api\.the-odds-api\.com/);
  assert.match(route, /requireCommissioner/);
  assert.match(migration, /pg_database_size/);
  assert.match(migration, /revoke all.*from public, anon, authenticated/i);
  assert.match(panel, /Setup needed/);
  assert.match(panel, /Unknown plan limits show a live count/);
  assert.match(panel, /30-DAY EFFICIENCY/);
  assert.match(panel, /CALENDAR MONTH/);
  assert.match(panel, /scheduled month-end/);
  assert.doesNotMatch(panel, /not in app logs|untrackedCredits/);
  assert.match(panel, /credits \/ final/);
  assert.match(panel, /Dashboard only/);
  assert.match(panel, /liveCountWithoutLimit/);
  assert.match(capacity, /storage_table_usage/);
  assert.match(capacity, /UPTIMEROBOT_READ_ONLY_API_KEY/);
  assert.match(capacity, /getAccountDetails/);
  assert.match(capacity, /cached for five minutes/);
  // GitHub Actions minutes are not tracked: this repository is public, so they are free.
  assert.doesNotMatch(capacity, /GitHub Actions|settings\/billing|GITHUB_FREE_ACTIONS_MINUTES/);
  // The two Vercel allowances that run close to their limits are estimated from this project's own records.
  assert.match(capacity, /Fluid Active CPU/);
  assert.match(capacity, /Functions Storage/);
  assert.match(capacity, /connection: "estimated"/);
  assert.match(capacity, /SENTRY_USAGE_TOKEN/);
  assert.match(capacity, /stats_v2/);
  assert.match(capacity, /SENTRY_ERROR_EVENT_LIMIT/);
  assert.match(capacity, /Sentry did not provide a readable usage response/);
  assert.match(route, /storageTables/);
  assert.match(guardrails, /skip_duplicate_preliminary_spread_snapshot/);
  assert.match(guardrails, /prune_operational_storage/);
  assert.match(guardrails, /180 days/);
  assert.match(watchdog, /isWeeklyStoragePruneDue/);
  assert.match(watchdog, /prune_operational_storage/);
  assert.match(guardrails, /revoke all.*storage_table_usage.*from public, anon, authenticated/i);
  assert.match(panel, /See what uses database space/);
});

test("the Vercel estimates reproduce the observed 30-day figures", async () => {
  const { estimateFluidCpu, estimateFunctionsStorageBytes } = await import("../src/lib/vercel-usage-estimate.js");
  // Calibration points from Vercel's Usage page: about 4h of CPU with 11 active players, 10.4 GB over 730 deployments.
  assert.ok(Math.abs(estimateFluidCpu({ activePlayers: 11 }).seconds / 3600 - 4) < 0.1);
  assert.ok(Math.abs(estimateFunctionsStorageBytes(730) / 1024 ** 3 - 10.4) < 0.05);
  assert.ok(estimateFluidCpu({ activePlayers: 5 }).seconds < estimateFluidCpu({ activePlayers: 11 }).seconds);
});
