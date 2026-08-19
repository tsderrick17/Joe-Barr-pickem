import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Commissioner player list exposes a coarse last-active timestamp without activity details", async () => {
  const [migration, route, helper] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260818022000_add_player_last_activity.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/players/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/player-activity.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /last_active_at timestamptz/);
  assert.match(route, /last_active_at/);
  assert.match(route, /lastActiveAt/);
  assert.match(helper, /last_active_at/);
});
