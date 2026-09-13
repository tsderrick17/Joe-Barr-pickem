import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("player submissions do not wait for a pool-wide maintenance RPC", async () => {
  const [picks, survivor] = await Promise.all([
    readFile(new URL("../src/app/api/picks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/survivor/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(picks, /voidDisruptedPicks/);
  assert.doesNotMatch(survivor, /voidDisruptedPicks|eliminateSurvivorNoPicks/);
});

test("database replacements void only the submitter's disrupted receipts atomically", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260913130000_decouple_player_saves_from_global_maintenance.sql", import.meta.url), "utf8");

  assert.match(migration, /p\.player_id = target_player_id/);
  assert.match(migration, /p\.survivor_entry_id = target_survivor_entry_id/);
  assert.match(migration, /g\.status in \('postponed', 'cancelled', 'no_contest'\)/);
  assert.match(migration, /perform public\.replace_unlocked_picks\(/);
  assert.match(migration, /perform public\.replace_unlocked_survivor_pick\(/);
});

test("Bowl Pool reports a temporary data-service outage instead of a false sign-out", async () => {
  const route = await readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8");

  assert.match(route, /type PlayerLookup/);
  assert.match(route, /"The Bowl Pool service is temporarily unavailable\. Please try again\."/);
  assert.match(route, /playerLookup\.error === "unavailable" \? 503 : 401/);
});
