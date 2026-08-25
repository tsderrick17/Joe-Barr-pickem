import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("launch preflight verifies every external game-day dependency without sending or importing", async () => {
  const source = await readFile(new URL("../src/lib/launch-preflight.ts", import.meta.url), "utf8");
  assert.match(source, /\/v4\/sports\//);
  assert.match(source, /all:\s*"true"/);
  assert.match(source, /https:\/\/api\.brevo\.com\/v3\/senders/);
  assert.match(source, /configuredSender\?\.active === true/);
  assert.match(source, /is_commissioner/);
  assert.match(source, /notification_email/);
  assert.match(source, /automation_cron_secret_matches/);
  assert.match(source, /assessAutomationHeartbeat/);
  assert.match(source, /supabase-server-authorization/);
  assert.match(source, /production server credential is accepted/);
  assert.doesNotMatch(source, /\/odds\/\?|\/smtp\/email|import-games/);
});

test("public health verifies both player and privileged database access", async () => {
  const source = await readFile(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /supabase\.from\("seasons"\)/);
  assert.match(source, /supabaseAdmin\.from\("seasons"\)/);
  assert.match(source, /Promise\.all/);
});

test("Opening Week checklist consumes the full live launch preflight", async () => {
  const source = await readFile(new URL("../src/app/api/admin/opening-week-checklist/route.ts", import.meta.url), "utf8");
  assert.match(source, /runLaunchPreflight/);
  assert.doesNotMatch(source, /rpc\("automation_preflight"\)/);
});

test("watchdog reuses external preflight checks on a daily drift cadence", async () => {
  const watchdog = await readFile(new URL("../src/lib/automation-watchdog.ts", import.meta.url), "utf8");
  const rules = await readFile(new URL("../src/lib/watchdog-rules.js", import.meta.url), "utf8");
  assert.match(watchdog, /runExternalConfigurationChecks/);
  assert.match(watchdog, /job_type:\s*"configuration_drift"/);
  assert.match(watchdog, /configurationChecks/);
  assert.match(rules, /America\/New_York/);
  assert.match(rules, /60 \* 60 \* 1000/);
});

test("scheduled isolated certification includes the live-week database rehearsal", async () => {
  const workflow = await readFile(new URL("../.github/workflows/isolated-integration.yml", import.meta.url), "utf8");
  const drill = await readFile(new URL("../scripts/season-drill.mjs", import.meta.url), "utf8");
  const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const rehearsal = await readFile(new URL("./integration/weekly-live-week-rehearsal.test.mjs", import.meta.url), "utf8");
  assert.match(workflow, /PICKEM_WEEKLY_REHEARSAL:\s*"true"/);
  assert.match(drill, /run\("test:all"\)/);
  assert.match(packageSource, /node --test test\/\*\*\/\*\.test\.mjs/);
  assert.match(rehearsal, /PICKEM_WEEKLY_REHEARSAL === "true"/);
  assert.match(rehearsal, /PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"/);
});
