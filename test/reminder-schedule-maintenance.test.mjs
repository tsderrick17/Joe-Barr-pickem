import "./helpers/typescript-renderer.mjs";
import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

// The slower reminder-schedule job, run for real: the route's gates and lease around the three reconcilers, with the reconcilers and the lease scripted.
const calls = [];
globalThis.maintenanceFixture = { idle: null, leaseError: null };
const stub = (body) => `data:text/javascript,${encodeURIComponent(body)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = {
      "@/lib/automatic-email-plan": "export const ensureAutomaticEmailPlanMessages = async () => globalThis.maintenanceCalls('email-plan', { created: 2 });",
      "@/lib/automatic-weekly-recap": "export const ensureAutomaticWeeklyRecap = async () => globalThis.maintenanceCalls('weekly-recap', { created: 1 });",
      "@/lib/automatic-bowl-pool-emails": "export const ensureAutomaticBowlPoolEmails = async () => globalThis.maintenanceCalls('bowl', { created: 0 });",
      "@/lib/off-season-gate": "export const skipOutsideSeason = async (kind) => globalThis.maintenanceCalls('gate:' + kind, globalThis.maintenanceFixture.idle);",
      "@/lib/automation-execution-lease": "export class AutomationAlreadyRunningError extends Error {}; export const runWithAutomationLease = async (name, work) => { globalThis.maintenanceCalls('lease:' + name); if (globalThis.maintenanceFixture.leaseError) throw globalThis.maintenanceFixture.leaseError(AutomationAlreadyRunningError); return work(); };",
    };
    if (mocks[specifier]) return { url: stub(mocks[specifier]), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
globalThis.maintenanceCalls = (name, value) => { calls.push(name); return value; };
const { NextRequest } = await import("next/server.js");
const { POST } = await import("../src/app/api/cron/maintain-reminders/route.ts");
const { maintainAutomaticReminderSchedule } = await import("../src/lib/automatic-reminder-maintenance.ts");
const post = (token = "Bearer s3cret") => POST(new NextRequest("http://localhost/api/cron/maintain-reminders", { method: "POST", headers: token ? { authorization: token } : {} }));
const reset = () => { calls.length = 0; globalThis.maintenanceFixture.idle = null; globalThis.maintenanceFixture.leaseError = null; };

test("the schedule job reconciles the email plan, then the weekly recap, then the Bowl emails", async () => {
  reset();
  const result = await maintainAutomaticReminderSchedule();
  assert.deepEqual(calls, ["email-plan", "weekly-recap", "bowl"]);
  assert.deepEqual(result, { emailPlan: { created: 2 }, weeklyRecap: { created: 1 }, bowlMessages: { created: 0 } });
});

test("the route refuses a missing secret or a wrong token before doing any work", async () => {
  reset();
  delete process.env.CRON_SECRET;
  assert.equal((await post()).status, 500);
  process.env.CRON_SECRET = "s3cret";
  assert.equal((await post("Bearer nope")).status, 401);
  assert.equal((await post(null)).status, 401);
  assert.deepEqual(calls, []);
});

test("an authorised run takes the reminder_schedule lease and answers with all three results", async () => {
  reset();
  process.env.CRON_SECRET = "s3cret";
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, emailPlan: { created: 2 }, weeklyRecap: { created: 1 }, bowlMessages: { created: 0 } });
  assert.deepEqual(calls, ["gate:season", "lease:reminder_schedule", "email-plan", "weekly-recap", "bowl"]);
});

test("outside the season the route answers with the gate's response and reconciles nothing", async () => {
  reset();
  process.env.CRON_SECRET = "s3cret";
  globalThis.maintenanceFixture.idle = Response.json({ success: true, skipped: true, message: "off-season" });
  const response = await post();
  assert.equal((await response.json()).skipped, true);
  assert.deepEqual(calls, ["gate:season"]);
});

test("a run already holding the lease is a skip, and any other failure is a 500 that says why", async () => {
  reset();
  process.env.CRON_SECRET = "s3cret";
  globalThis.maintenanceFixture.leaseError = (Already) => new Already("reminder_schedule is already running");
  const busy = await post();
  assert.equal(busy.status, 200);
  assert.deepEqual(await busy.json(), { success: true, skipped: true, message: "reminder_schedule is already running" });
  globalThis.maintenanceFixture.leaseError = () => new Error("database unreachable");
  const failed = await post();
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { success: false, error: "database unreachable" });
  assert.deepEqual(calls.filter((c) => ["email-plan", "weekly-recap", "bowl"].includes(c)), []);
});
