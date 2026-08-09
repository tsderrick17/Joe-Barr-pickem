import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const healthSource = await readFile(new URL("../src/lib/automation-health.ts", import.meta.url), "utf8");
const emailSchema = await readFile(new URL("../supabase/migrations/20260728005000_add_email_reminder_delivery.sql", import.meta.url), "utf8");
const pushSchema = await readFile(new URL("../supabase/migrations/20260728004000_add_push_reminder_system.sql", import.meta.url), "utf8");

test("automation retention queries use the delivery receipt timestamp", () => {
  assert.match(emailSchema, /email_reminder_deliveries[\s\S]*attempted_at timestamptz/i);
  assert.match(pushSchema, /push_reminder_deliveries[\s\S]*attempted_at timestamptz/i);
  assert.match(healthSource, /from\("email_reminder_deliveries"\)[^\n]+\.lt\("attempted_at", retentionCutoff\)/);
  assert.match(healthSource, /from\("push_reminder_deliveries"\)[^\n]+\.lt\("attempted_at", retentionCutoff\)/);
  assert.doesNotMatch(healthSource, /reminder_deliveries"\)[^\n]+\.lt\("created_at"/);
});
