import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const { GAME_STATUSES, asGameStatus, asPeriodStatus, asPeriodType } = await import("../src/lib/db-statuses.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the shared game statuses are exactly what the database constraint allows", async () => {
  const migration = await read("supabase/migrations/20260805010000_season_progression_and_scoring_policy.sql");
  const allowed = [...migration.match(/games_status_check\s+check \(status in \(([^)]*)\)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...GAME_STATUSES].sort(), [...allowed].sort());
});

test("a status the database does not allow fails loudly instead of passing as one that is", () => {
  assert.equal(asGameStatus("no_contest"), "no_contest");
  assert.equal(asPeriodStatus("active"), "active");
  assert.equal(asPeriodType("playoff"), "playoff");
  assert.throws(() => asGameStatus("delayed"), /Unexpected game status/);
  assert.throws(() => asPeriodStatus("paused"), /Unexpected scoring period status/);
  assert.throws(() => asPeriodType("preseason"), /Unexpected scoring period type/);
});

test("both Supabase clients use the committed database types, and no route keeps its own game-status list", async () => {
  assert.match(await read("src/lib/supabase-admin.ts"), /createClient<Database>\(/);
  assert.match(await read("src/lib/supabase.ts"), /createClient<Database>\(/);
  const types = await read("src/lib/database.types.ts");
  assert.match(types, /export type Database = \{/);
  assert.match(types, /bowl_pool_game_lines: \{/);
  // The hand-written unions that used to disagree about no_contest are gone.
  for (const file of ["src/lib/api-contracts.ts", "src/lib/slate-shape.ts", "src/components/slate-game-row.tsx", "src/app/api/admin/grading-dashboard/route.ts", "src/app/api/admin/operations-map/route.ts", "src/lib/advance-scoring-periods.ts", "src/lib/sync-final-scores.ts"]) {
    assert.doesNotMatch(await read(file), /"scheduled" \| "live" \| "final" \| "postponed" \| "cancelled"/, file);
  }
});

test("a game called off with no contest is not shown as live on the Slate", async () => {
  const row = await read("src/components/slate-game-row.tsx");
  assert.match(row, /game\.status !== "no_contest"/);
  assert.match(row, /"NO CONTEST"/);
});

test("the Bowl recap reads only columns that exist on players (it used to ask for a last_name that is not there)", async () => {
  assert.doesNotMatch(await read("src/lib/bowl-pool-recap.ts"), /last_name/);
});

test("the schema-drift check and generator refuse anything but the confirmed isolated project", async () => {
  const script = await read("scripts/database-types.mjs");
  assert.match(script, /PICKEM_TEST_DATABASE_CONFIRMATION !== "isolated"/);
  assert.match(script, /lrimviwfflrisshmgnsh/);
  const workflow = await read(".github/workflows/isolated-integration.yml");
  assert.match(workflow, /npm run db:types:check/);
  assert.match(workflow, /write_database_types/);
});
