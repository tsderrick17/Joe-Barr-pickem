import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the scheduled reminder reconciler receives its lease cancellation signal", async () => {
  const route = await read("../src/app/api/cron/maintain-reminders/route.ts");
  const maintenance = await read("../src/lib/automatic-reminder-maintenance.ts");
  assert.match(route, /runWithAutomationLeaseContext\("reminder_schedule", \(\{ signal \}\) => maintainAutomaticReminderSchedule\(signal\)\)/);
  assert.match(maintenance, /signal\?\.throwIfAborted\(\);\s*const emailPlan = await ensureAutomaticEmailPlanMessages\(signal\);\s*signal\?\.throwIfAborted\(\);\s*const weeklyRecap = await ensureAutomaticWeeklyRecap\(new Date\(\), signal\);\s*signal\?\.throwIfAborted\(\);\s*const bowlMessages = await ensureAutomaticBowlPoolEmails\(new Date\(\), signal\);\s*signal\?\.throwIfAborted\(\)/);
});

test("the Pick'em email plan checks cancellation between reconciliation reads and writes", async () => {
  const source = await read("../src/lib/automatic-email-plan.ts");
  assert.match(source, /ensureAutomaticEmailPlanMessages\(signal\?: AbortSignal\)[\s\S]*?signal\?\.throwIfAborted\(\);\s*const \{ data: period/);
  assert.match(source, /for \(const row of rows\) \{\s*signal\?\.throwIfAborted\(\);[\s\S]*?\.eq\("status", "scheduled"\);\s*signal\?\.throwIfAborted\(\)/);
  assert.match(source, /signal\?\.throwIfAborted\(\);\s*const \{ data, error \} = await supabaseAdmin[\s\S]*?\.insert\(missingRows\)[\s\S]*?signal\?\.throwIfAborted\(\)/);
});

test("weekly recap and Bowl reminder creation stop at safe idempotent boundaries", async () => {
  const [weekly, bowl] = await Promise.all([
    read("../src/lib/automatic-weekly-recap.ts"),
    read("../src/lib/automatic-bowl-pool-emails.ts"),
  ]);
  assert.match(weekly, /findLatestSettledWeeklyRecapPeriod\(\);\s*signal\?\.throwIfAborted\(\)/);
  assert.match(weekly, /signal\?\.throwIfAborted\(\);\s*const \{ data, error \} = await supabaseAdmin[\s\S]*?\.insert\([\s\S]*?signal\?\.throwIfAborted\(\)/);
  assert.match(bowl, /async function queue\([\s\S]*?signal\?\.throwIfAborted\(\);\s*const \{ error \} = await supabaseAdmin\.from\("push_reminders"\)\.insert\(message\);\s*signal\?\.throwIfAborted\(\)/);
  assert.match(bowl, /for \(const game of games\.filter[\s\S]*?\{\s*signal\?\.throwIfAborted\(\)/);
});
