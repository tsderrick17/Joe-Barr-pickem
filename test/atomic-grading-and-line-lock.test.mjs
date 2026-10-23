import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260929010000_atomic_grading_and_line_lock.sql", import.meta.url),
  "utf8",
);

const functions = [
  "recover_pending_ats_grades()",
  "grade_bowl_pool_final_picks(timestamptz)",
  "lock_official_lines_atomically(jsonb, timestamptz)",
];

test("atomic grading and line-lock functions are service-role only", () => {
  for (const signature of functions) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature.replace(/[()]/g, "\\$&")} from public, anon, authenticated;`),
      `${signature} must revoke public access`,
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to service_role;`),
      `${signature} must be callable by the service role`,
    );
  }
  assert.equal((migration.match(/security definer/g) ?? []).length, 3);
  assert.equal((migration.match(/set search_path = public/g) ?? []).length, 3);
});

test("Bowl grading saves the pick and its receipt in one statement and repairs stranded receipts", () => {
  assert.match(migration, /update public\.bowl_pool_picks as pick[\s\S]*?returning pick\.entry_id, pick\.game_id, pick\.result/);
  assert.match(migration, /insert into public\.bowl_pool_game_results[\s\S]*?from updated/);
  assert.match(migration, /Repair receipts stranded by the earlier two-step write/);
  // Bowl PK games are straight up and a tie is a loss; half-point spreads cannot push.
  assert.match(migration, /when locked_spread = 0 then/);
  assert.match(migration, /\) > 0 then 'win'\s+else 'loss'/);
});

test("ATS recovery keeps pushes as losses and never guesses without an official line", () => {
  assert.match(migration, /when favorite_team_id is null\s+or locked_spread is null/);
  assert.match(migration, /\) > 0 then 'win'\s+else 'loss'/);
  assert.match(migration, /and pick\.result = 'pending'\s+and decided\.grade is not null/);
});

test("official line, history snapshot, and audit entry are saved together and audit only real inserts", () => {
  assert.match(migration, /insert into public\.spread_history/);
  assert.match(migration, /insert into public\.game_lines[\s\S]*?on conflict \(game_id\) do nothing\s+returning game_id/);
  assert.match(migration, /insert into public\.audit_logs[\s\S]*?join inserted on inserted\.game_id = incoming\.game_id/);
  assert.match(migration, /'official_line_locked'/);
});


test("the season year is evaluated on every call, never frozen at module load", async () => {
  const season = await import("../src/lib/season.ts");
  assert.equal(season.seasonYearAt(new Date("2026-08-01T03:59:00Z")), 2025, "before 12:00 AM Eastern on August 1");
  assert.equal(season.seasonYearAt(new Date("2026-08-01T04:01:00Z")), 2026, "after 12:00 AM Eastern on August 1");
  assert.equal(season.seasonYearAt(new Date("2027-01-20T12:00:00Z")), 2026, "playoffs belong to the season that began the prior August");
  assert.equal(typeof season.currentSeasonYear, "function");
  assert.equal("CURRENT_SEASON_YEAR" in season, false, "there is no constant frozen at load");
});

test("the real retry ladder is the only polling policy", async () => {
  const { SCORE_POLLING_RETRY_MINUTES } = await import("../src/lib/score-check-backoff.ts");
  assert.deepEqual([...SCORE_POLLING_RETRY_MINUTES], [10, 10, 10, 10, 10, 10, 20, 20, 20, 60, 120, 240]);
});

test("every automation job has one settings row with a timeout shorter than its lease", async () => {
  const source = await readFile(new URL("../src/lib/automation-execution-lease.ts", import.meta.url), "utf8");
  const rows = [...source.matchAll(/^\s+(\w+): \{ leaseSeconds: (\d+), timeoutSeconds: (\d+), label: "([^"]+)" \},$/gm)];
  assert.equal(rows.length, 8);
  for (const [, job, lease, timeout, label] of rows) {
    assert.ok(Number(timeout) < Number(lease), `${job} timeout must be shorter than its lease`);
    assert.ok(label.length > 3);
  }
  const union = source.match(/export type AutomationJob = ([^;]+);/)[1].match(/"(\w+)"/g).map((name) => name.replaceAll('"', ""));
  assert.deepEqual(rows.map((row) => row[1]).sort(), union.sort());
});

const activationMigration = await readFile(new URL("../supabase/migrations/20260929020000_atomic_period_activation.sql", import.meta.url), "utf8");

test("period activation refuses to skip, double-activate, or open an empty period", () => {
  assert.match(activationMigration, /revoke all on function public\.activate_scoring_period_atomically\(uuid, timestamptz\) from public, anon, authenticated;/);
  assert.match(activationMigration, /grant execute on function public\.activate_scoring_period_atomically\(uuid, timestamptz\) to service_role;/);
  assert.match(activationMigration, /pg_advisory_xact_lock\(hashtextextended\(target_period\.season_id::text \|\| ':weekly-handoff', 0\)\)/, "must share the weekly handoff lock");
  for (const reason of ["Another scoring period is already active.", "An earlier scoring period has not been completed.", "cannot activate without an imported schedule", "has not reached its start time"]) {
    assert.ok(activationMigration.includes(reason), `missing guard: ${reason}`);
  }
  assert.match(activationMigration, /'scoring_period_activated'/);
});

test("activation takes the per-season lock before locking any period row", async () => {
  const fix = await readFile(new URL("../supabase/migrations/20260929030000_activation_lock_order.sql", import.meta.url), "utf8");
  const lock = fix.indexOf("pg_advisory_xact_lock");
  const rowLock = fix.indexOf("for update;");
  assert.ok(lock > 0 && rowLock > lock, "the advisory lock must come before the period row lock");
  assert.doesNotMatch(fix.slice(0, lock), /for update/);
  assert.match(fix, /grant execute on function public\.activate_scoring_period_atomically\(uuid, timestamptz\) to service_role;/);
});

