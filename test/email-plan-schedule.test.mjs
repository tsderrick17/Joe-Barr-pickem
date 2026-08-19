import assert from "node:assert/strict";
import test from "node:test";
import { buildEmailPlanSchedule } from "../src/lib/email-plan-schedule.js";
import { readFile } from "node:fs/promises";

const period = { id: "week-1", period_type: "regular" };
const game = (id, kickoff_at, extra = {}) => ({ id, kickoff_at, line_lock_at: kickoff_at, is_international: false, status: "scheduled", ...extra });

test("regular email plans create one deterministic occurrence for each promised window", () => {
  const schedule = buildEmailPlanSchedule(period, [
    game("thu", "2026-09-11T00:20:00.000Z"),
    game("intl", "2026-09-13T13:30:00.000Z", { is_international: true, line_lock_at: "2026-09-13T12:30:00.000Z" }),
    game("sun-early", "2026-09-13T17:00:00.000Z"),
    game("sun-late", "2026-09-13T20:25:00.000Z"),
    game("sun-night", "2026-09-14T00:20:00.000Z"),
    game("mon", "2026-09-15T00:15:00.000Z"),
  ]);
  const templates = schedule.map((item) => item.templateId);
  assert.equal(templates.filter((id) => id === "weekly").length, 1);
  assert.equal(templates.filter((id) => id === "final_lines").length, 3);
  assert.equal(templates.filter((id) => id === "sunday_final_lines").length, 1);
  assert.equal(templates.filter((id) => id === "early_lock").length, 1);
  assert.equal(templates.filter((id) => id.startsWith("pick_due_")).length, 4);
  assert.equal(schedule.find((item) => item.templateId === "pick_due_sunday_6").scheduledFor, "2026-09-13T22:00:00.000Z");
  assert.equal(templates.filter((id) => id === "sunday_early_reveal").length, 1);
  assert.equal(templates.filter((id) => id === "sunday_late_reveal").length, 1);
  assert.equal(templates.filter((id) => id === "featured_window_reveal").length, 4);
  assert.equal(schedule.find((item) => item.templateId === "weekly").scheduledFor, "2026-09-09T10:30:00.000Z");
  assert.equal(schedule.find((item) => item.templateId === "final_lines" && item.automationKey.endsWith(":2026-09-10")).scheduledFor, "2026-09-11T00:20:00.000Z");
  assert.equal(new Set(schedule.map((item) => item.automationKey)).size, schedule.length);
});

test("playoff plans use kickoff reveals and one recap per game day", () => {
  const schedule = buildEmailPlanSchedule({ id: "wild-card", period_type: "playoff" }, [
    game("sat-1", "2027-01-09T21:30:00.000Z"),
    game("sat-2", "2027-01-10T01:15:00.000Z"),
    game("sun", "2027-01-10T18:00:00.000Z"),
  ]);
  assert.equal(schedule.filter((item) => item.templateId === "playoff_public_reveal").length, 3);
  assert.equal(schedule.filter((item) => item.templateId === "playoff_day_recap").length, 2);
  assert.equal(schedule.filter((item) => item.templateId === "featured_window_reveal").length, 0);
});

test("cancelled games do not create email occurrences", () => {
  assert.deepEqual(buildEmailPlanSchedule(period, [game("cancelled", "2026-09-13T17:00:00.000Z", { status: "cancelled" })]), []);
});

test("a rescheduled game produces replacement keys while preserving the game receipt", () => {
  const first = buildEmailPlanSchedule(period, [game("flexed", "2026-09-13T17:00:00.000Z")]);
  const flexed = buildEmailPlanSchedule(period, [game("flexed", "2026-09-14T00:20:00.000Z")]);
  assert.notDeepEqual(first.map((item) => item.automationKey), flexed.map((item) => item.automationKey));
  assert.ok(flexed.every((item) => !item.sourceGameIds.length || item.sourceGameIds.includes("flexed")));
});

test("email automation allows multiple window messages while keeping weekly recap unique", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260818011000_automate_email_plan_messages.sql", import.meta.url), "utf8");
  assert.match(migration, /drop index if exists public\.push_reminders_one_automatic_recap_per_period/);
  assert.match(migration, /where category = 'weekly_recap'/);
  assert.match(migration, /push_reminders_automation_key_unique/);
});
