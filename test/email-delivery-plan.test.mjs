import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const deliveryPlan = await readFile(new URL("../src/lib/email-delivery-plan.ts", import.meta.url), "utf8");
const emailReminders = await readFile(new URL("../src/lib/email-reminders.ts", import.meta.url), "utf8");

test("routine email policy keeps deadline and schedule-change notices outside the daily limit", () => {
  assert.match(deliveryPlan, /"weekly_recap"/);
  assert.match(deliveryPlan, /"sunday_late_reveal"/);
  assert.doesNotMatch(deliveryPlan, /"pick_due"/);
  assert.doesNotMatch(deliveryPlan, /"early_lock"/);
});

test("routine delivery holds are recorded rather than treated as failed sends", () => {
  assert.match(emailReminders, /routineEmailLimitReached/);
  assert.match(emailReminders, /status: "suppressed"/);
  assert.match(emailReminders, /Routine email limit reached for this Eastern calendar day/);
});
