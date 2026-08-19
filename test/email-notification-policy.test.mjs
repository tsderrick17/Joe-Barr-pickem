import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { emailPreferenceColumn } from "../src/lib/email-plan-preferences.js";
import { automaticEmailSubject } from "../src/lib/email-subjects.js";
import { publicRevealSelectionReadiness } from "../src/lib/reminder-readiness-rules.js";
import { weeklyRecapTemplateId } from "../src/lib/weekly-recap-template.js";

test("maps the four pick reminders to three independent player choices", () => {
  assert.equal(emailPreferenceColumn("pick_due", "plan:w1:pick_due_sunday_11:date:11"), "email_pick_due_sunday_early_enabled");
  assert.equal(emailPreferenceColumn("pick_due", "plan:w1:pick_due_sunday_3:date:15"), "email_pick_due_sunday_afternoon_enabled");
  assert.equal(emailPreferenceColumn("pick_due", "plan:w1:pick_due_sunday_6:date:18"), "email_pick_due_primetime_enabled");
  assert.equal(emailPreferenceColumn("pick_due", "plan:w1:pick_due_monday:date:17"), "email_pick_due_primetime_enabled");
});

test("automatic subjects retain custom wording while adding week or playoff date context", () => {
  assert.equal(automaticEmailSubject({ templateId: "weekly", title: "{{week}} Slate is ready", periodName: "Week 8" }), "Week 8 Slate is ready");
  assert.equal(automaticEmailSubject({ templateId: "weekly_recap", title: "Pool recap", periodName: "Week 7" }), "Pool recap — Week 7");
  assert.equal(automaticEmailSubject({ templateId: "playoff_day_recap", title: "Playoff recap — {{date}}", periodName: "Wild Card", eventAt: "2027-01-17T21:30:00.000Z" }), "Playoff recap — Sunday, Jan 17");
});

test("an empty public-pick window is a terminal suppression rather than a retry", () => {
  assert.deepEqual(publicRevealSelectionReadiness({ kickoffReady: { ready: true, reason: null }, selectedPickCount: 0 }), {
    ready: false,
    terminal: true,
    reason: "No player selected a game in this public-pick window.",
  });
  assert.equal(publicRevealSelectionReadiness({ kickoffReady: { ready: true, reason: null }, selectedPickCount: 1 }).ready, true);
});

test("weekly recap keeps Survivor for its finish, then switches to Pick'em-only", () => {
  assert.equal(weeklyRecapTemplateId({ activeEntryCount: 4, championCrownedInPeriod: false }), "weekly_recap");
  assert.equal(weeklyRecapTemplateId({ activeEntryCount: 1, championCrownedInPeriod: true }), "weekly_recap");
  assert.equal(weeklyRecapTemplateId({ activeEntryCount: 1, championCrownedInPeriod: false }), "weekly_recap_pickem_only");
});

test("the preference migration preserves the old reminder choice and supports explicit suppression receipts", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260818020000_split_pick_due_preferences_and_suppress_empty_reveals.sql", import.meta.url), "utf8");
  assert.match(migration, /coalesce\(email_pick_due_sunday_early_enabled, email_pick_due_enabled\)/);
  assert.match(migration, /coalesce\(email_pick_due_sunday_afternoon_enabled, email_pick_due_enabled\)/);
  assert.match(migration, /coalesce\(email_pick_due_primetime_enabled, email_pick_due_enabled\)/);
  assert.match(migration, /'suppressed'/);
});

test("the Commissioner email route no longer accepts hand-scheduled messages", async () => {
  const route = await readFile(new URL("../src/app/api/admin/reminders/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /export async function POST/);
});
