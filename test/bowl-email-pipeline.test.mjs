import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Bowl email worker queues immutable daily recaps and game-specific pick reminders", () => {
  const source = read("src/lib/automatic-bowl-pool-emails.ts");
  assert.match(source, /bowlDailyRecapAt\(day\)/);
  assert.match(source, /unpickedBowlReminderAt\(game\.kickoff_at\)/);
  assert.match(source, /bowl:\$\{season\.id\}:daily-recap/);
  assert.match(source, /bowl:\$\{season\.id\}:pick-due/);
  assert.match(source, /source_game_ids: dayGames\.map/);
  assert.match(source, /category: "bowl_line_lock"/);
  assert.match(source, /bowl:\$\{season\.id\}:line-lock/);
});

test("Bowl email delivery snapshots the recap and sends reminders only to active unpicked entries", () => {
  const source = read("src/lib/email-reminders.ts");
  assert.match(source, /ensureBowlDailyRecapSnapshot/);
  assert.match(source, /from\("bowl_pool_entries"\)/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.match(source, /from\("bowl_pool_picks"\)/);
  assert.match(source, /email_notifications_enabled/);
  assert.match(source, /kind: "bowl"/);
  assert.match(source, /ensureBowlLineLockSnapshot/);
});

test("Bowl email readiness waits for final results and suppresses expired pick windows", () => {
  const source = read("src/lib/reminder-readiness.ts");
  assert.match(source, /bowlDailyRecapReady/);
  assert.match(source, /\["final", "cancelled", "no_contest", "postponed"\]/);
  assert.match(source, /bowlPickDueReady/);
  assert.match(source, /The Bowl selection window has closed/);
});

test("Bowl line-lock readiness waits for every playable game to have a locked line", () => {
  const source = read("src/lib/reminder-readiness.ts");
  assert.match(source, /bowlLineLockReady/);
  assert.match(source, /Today’s Bowl lines are still being finalized/);
  assert.match(source, /category === "bowl_line_lock"/);
});

test("Bowl score automation has its own fifteen-minute endpoint", () => {
  const route = read("src/app/api/cron/sync-bowl-scores/route.ts");
  const nflRoute = read("src/app/api/cron/sync-scores/route.ts");
  const migration = read("supabase/migrations/20260922020000_isolate_bowl_pool_cron.sql");
  assert.match(route, /runWithAutomationLease\("bowl_scores", syncBowlPool\)/);
  assert.doesNotMatch(nflRoute, /syncBowlPool/);
  assert.match(migration, /refresh-bowl-pool-every-fifteen-minutes/);
  assert.match(migration, /'\/api\/cron\/sync-bowl-scores'/);
  assert.match(migration, /'\*\/15 \* \* \* \*'/);
});

test("Bowl score settlement works from ESPN without a paid NCAAF odds key", () => {
  const source = read("src/lib/sync-bowl-pool.ts");
  assert.match(source, /college-football\/scoreboard/);
  assert.match(source, /provider_game_id/);
  assert.match(source, /status\?\.type\?\.completed/);
  assert.match(source, /ESPN is the no-cost source of truth for bowl results/);
});
