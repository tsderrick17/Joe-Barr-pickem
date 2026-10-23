import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Database size and per-table storage details are for the Commissioner's server code only. (That the route itself uses commissionerAccess is checked
// for every admin route in access-boundaries.test.mjs; the panel's wording is in the Performance and System screenshots.)
test("database size and per-table storage details are not readable by players or the public", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260819010000_add_account_capacity_measurement.sql", import.meta.url), "utf8");
  const guardrails = await readFile(new URL("../supabase/migrations/20260819020000_add_storage_guardrails.sql", import.meta.url), "utf8");
  assert.match(migration, /revoke all.*from public, anon, authenticated/i);
  assert.match(guardrails, /revoke all.*storage_table_usage.*from public, anon, authenticated/i);
});

test("the Vercel estimates reproduce the observed 30-day figures", async () => {
  const { estimateFluidCpu, estimateFunctionsStorageBytes } = await import("../src/lib/vercel-usage-estimate.js");
  // Calibration points from Vercel's Usage page: 3h 16m of CPU with 11 active players (2026-10-19), 10.4 GB over 730 deployments.
  assert.ok(Math.abs(estimateFluidCpu({ activePlayers: 11 }).seconds / 3600 - (3 + 16 / 60)) < 0.05);
  assert.ok(Math.abs(estimateFunctionsStorageBytes(730) / 1024 ** 3 - 10.4) < 0.05);
  assert.ok(estimateFluidCpu({ activePlayers: 5 }).seconds < estimateFluidCpu({ activePlayers: 11 }).seconds);
});
