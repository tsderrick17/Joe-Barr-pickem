import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260913050000_clear_zac_locked_patriots_survivor_pick.sql", import.meta.url), "utf8");

test("the one-time Survivor correction is narrowly scoped and audited", () => {
  assert.match(migration, /lower\(trim\(player\.first_name\)\) = 'zac'/);
  assert.match(migration, /season\.year = 2026/);
  assert.match(migration, /upper\(team\.abbreviation\) = 'NE'/);
  assert.match(migration, /pick\.result = 'pending'/);
  assert.match(migration, /if matching_pick_count > 1 then\s+raise exception/s);
  assert.match(migration, /delete from public\.survivor_picks where id = target_pick_id/);
  assert.match(migration, /survivor_pick_cleared_by_commissioner/);
});
