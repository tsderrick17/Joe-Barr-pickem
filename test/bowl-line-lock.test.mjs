import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getLineLock } from "../src/lib/schedule-time.js";
import { parseBowlPoolScheduleCsv } from "../src/lib/bowl-pool-schedule.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a Bowl line locks at 8 AM Eastern on game day, like an NFL spread", () => {
  // Saturday Dec 20, 2026, 3:30 PM Eastern kickoff: lock at 8 AM Eastern the same day (13:00 UTC in winter).
  assert.equal(getLineLock(new Date("2026-12-20T20:30:00Z")).lineLockAt, "2026-12-20T13:00:00.000Z");
  // A night game keeps the same morning lock; the lock is never at kickoff.
  const night = getLineLock(new Date("2026-12-30T01:00:00Z"));
  assert.equal(night.lineLockAt, "2026-12-29T13:00:00.000Z");
});

test("the schedule CSV import gives each Bowl game that same game-day lock instead of the kickoff time", () => {
  const rows = parseBowlPoolScheduleCsv("order,bowl_name,kickoff_at,game_key\n1,Frisco Bowl,2026-12-19T17:30:00Z,espn:1\n");
  assert.equal(rows[0].kickoff_at, "2026-12-19T17:30:00.000Z");
  assert.equal(rows[0].line_lock_at, "2026-12-19T13:00:00.000Z");
  assert.notEqual(rows[0].line_lock_at, rows[0].kickoff_at);
});

test("the provider sync stores a preliminary line with locked_at empty until the game-day lock, then fixes it", async () => {
  const sync = await read("src/lib/sync-bowl-pool.ts");
  assert.match(sync, /line_lock_at: getLineLock\(new Date\(kickoff\)\)\.lineLockAt/);
  assert.match(sync, /locked_at: lockStampFor\(row\.line_lock_at, now\) as string/);
  // A line that is already locked is never replaced by a later provider refresh.
  assert.match(sync, /\.update\(provisionalLine\)\.eq\("game_id", saved\.id\)\.is\("locked_at", null\)/);
  assert.match(sync, /if \(!lineIsDueToLock\(game\.line_lock_at, now, alreadyLocked\.has\(game\.id\)\)\) continue;/);
  assert.doesNotMatch(sync, /KNOWN DEFECT/);
});

test("the migration lets a line be preliminary and stops a preliminary line freezing the matchup", async () => {
  const sql = await read("supabase/migrations/20261007020000_bowl_provisional_lines.sql");
  assert.match(sql, /alter column locked_at drop not null/);
  assert.match(sql, /alter column locked_at drop default/);
  assert.match(sql, /exists \(select 1 from bowl_pool_game_lines where game_id=old\.id and locked_at is not null\)/);
  assert.match(sql, /exists \(select 1 from bowl_pool_picks where game_id=old\.id\)/, "picks still freeze the matchup");
});

test("health, integrity and the official-lines email count only locked lines", async () => {
  assert.match(await read("src/lib/bowl-pool-health.ts"), /\.select\("game_id"\)\.not\("locked_at", "is", null\)/);
  assert.match(await read("src/lib/bowl-pool-recap.ts"), /find\(\(candidate\) => candidate\?\.locked_at\)/);
});
