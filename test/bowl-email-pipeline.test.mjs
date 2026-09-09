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
});

test("Bowl email delivery snapshots the recap and sends reminders only to active unpicked entries", () => {
  const source = read("src/lib/email-reminders.ts");
  assert.match(source, /ensureBowlDailyRecapSnapshot/);
  assert.match(source, /from\("bowl_pool_entries"\)/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.match(source, /from\("bowl_pool_picks"\)/);
  assert.match(source, /email_notifications_enabled/);
  assert.match(source, /kind=bowl/);
});

test("Bowl email readiness waits for final results and suppresses expired pick windows", () => {
  const source = read("src/lib/reminder-readiness.ts");
  assert.match(source, /bowlDailyRecapReady/);
  assert.match(source, /\["final", "cancelled", "no_contest", "postponed"\]/);
  assert.match(source, /bowlPickDueReady/);
  assert.match(source, /The Bowl selection window has closed/);
});
