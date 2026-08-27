import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_FALLBACK_LINE_AGE_MS,
  isFallbackLineFresh,
} from "../src/lib/line-fallback-policy.js";
import {
  isPickableGameStatus,
  isSettledGameStatus,
} from "../src/lib/game-status-policy.js";

const migrationUrl = new URL(
  "../supabase/migrations/20260826010000_harden_pool_lifecycle_edges.sql",
  import.meta.url,
);

test("last-known lines expire after exactly 24 hours", () => {
  const checkedAt = "2026-09-13T12:00:00.000Z";
  assert.equal(MAX_FALLBACK_LINE_AGE_MS, 86_400_000);
  assert.equal(isFallbackLineFresh("2026-09-12T12:00:00.000Z", checkedAt), true);
  assert.equal(isFallbackLineFresh("2026-09-12T11:59:59.999Z", checkedAt), false);
  assert.equal(isFallbackLineFresh("not-a-date", checkedAt), false);
});

test("only scheduled games accept picks and every disruption settles a period", () => {
  assert.equal(isPickableGameStatus("scheduled"), true);
  for (const status of ["live", "final", "postponed", "cancelled", "no_contest"]) {
    assert.equal(isPickableGameStatus(status), false);
  }
  for (const status of ["final", "postponed", "cancelled", "no_contest"]) {
    assert.equal(isSettledGameStatus(status), true);
  }
  assert.equal(isSettledGameStatus("scheduled"), false);
  assert.equal(isSettledGameStatus("live"), false);
});

test("database gates future weeks and disrupted games independently of the browser", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /assert_scoring_period_accepts_picks/);
  assert.match(sql, /Only the immediate next Slate may open early/);
  assert.match(sql, /game_status <> 'scheduled'/);
  assert.match(sql, /next Eastern calendar day/);
  assert.match(sql, /replace_unlocked_picks_unchecked_20260826/);
  assert.match(sql, /replace_unlocked_survivor_pick_unchecked_20260826/);
});

test("playoff snapshots require the actual game day and reconciled prior games", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /game_day = eastern_today/);
  assert.match(sql, /game\.status in \('scheduled', 'live'\)/);
  assert.match(sql, /game\.status = 'final' and game\.finalized_at is null/);
  assert.match(sql, /pick\.result = 'pending'/);
  assert.match(sql, /snapshot_playoff_day_eligibility_unchecked_20260826/);
});

test("reminder claims are bounded and only receipt-free stale claims recover", async () => {
  const [sql, lease] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(new URL("../src/lib/automation-execution-lease.ts", import.meta.url), "utf8"),
  ]);
  assert.match(sql, /processing_started_at < clock_timestamp\(\) - interval '20 minutes'/);
  assert.match(sql, /not exists \([\s\S]*email_reminder_deliveries/);
  assert.match(sql, /limit 3\s+for update skip locked/);
  assert.match(lease, /reminders: 600/);
});

test("PIN failures use progressive source cooldowns without locking a player PIN", async () => {
  const [sql, route] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(new URL("../src/app/api/login/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(sql, /recent_attempts >= 10/);
  assert.match(sql, /interval '15 minutes'/);
  assert.match(sql, /recent_attempts >= 5/);
  assert.match(sql, /interval '1 minute'/);
  assert.match(route, /pin_login_cooldown_seconds/);
  assert.match(route, /"Retry-After"/);
  assert.doesNotMatch(sql, /update public\.players/);
});

test("PK lines designate the home team and no-contests remain void", async () => {
  const [sql, lockSource] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(new URL("../src/lib/lock-due-lines.ts", import.meta.url), "utf8"),
  ]);
  assert.match(lockSource, /const favoriteTeamId = game\.home_team_id/);
  assert.match(sql, /return query select 0, 0/);
  assert.match(sql, /not exists \([\s\S]*from public\.survivor_picks survivor_pick/);
  assert.doesNotMatch(sql, /no_contest_graded_loss/);
});
