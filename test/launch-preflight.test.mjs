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
  assert.doesNotMatch(source, /\/odds\/\?|\/smtp\/email|import-games/);
});

test("Opening Week checklist consumes the full live launch preflight", async () => {
  const source = await readFile(new URL("../src/app/api/admin/opening-week-checklist/route.ts", import.meta.url), "utf8");
  assert.match(source, /runLaunchPreflight/);
  assert.doesNotMatch(source, /rpc\("automation_preflight"\)/);
});
