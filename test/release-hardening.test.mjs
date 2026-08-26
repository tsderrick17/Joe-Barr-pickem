import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRODUCTION_SMOKE_PATHS } from "../scripts/production-smoke.mjs";

test("eligible pull requests run the real isolated browser flow", async () => {
  const workflow = await readFile(new URL("../.github/workflows/isolated-integration.yml", import.meta.url), "utf8");
  const browser = await readFile(new URL("./e2e/player-flow.spec.ts", import.meta.url), "utf8");
  const config = await readFile(new URL("../playwright.config.ts", import.meta.url), "utf8");

  assert.match(workflow, /PICKEM_E2E_ENABLED:\s*"true"/);
  assert.match(workflow, /PICKEM_TEST_SUPABASE_URL/);
  assert.match(workflow, /PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(workflow, /PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(config, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(browser, /is_commissioner:\s*true/);
  assert.match(browser, /name:\s*"Commissioner"/);
  assert.match(browser, /name:\s*"Notifications"/);
  assert.match(browser, /name:\s*"Sign out"/);
  assert.match(browser, /temporary profile failure/);
  assert.match(browser, /cleanupStaleFixtures/);
  assert.match(browser, /Retired E2E \$\{playerId\.slice\(0, 8\)\}/);
  assert.match(browser, /like\("first_name", "E2E %"\)/);
  assert.match(browser, /like\("external_game_id", "e2e-%"\)/);
});

test("Dependabot pull requests never receive isolated database credentials", async () => {
  const workflow = await readFile(new URL("../.github/workflows/isolated-integration.yml", import.meta.url), "utf8");

  assert.match(workflow, /group:\s*isolated-integration-shared-database/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /dependabot-safety:/);
  assert.match(
    workflow,
    /github\.event_name == 'pull_request' && github\.event\.pull_request\.user\.login == 'dependabot\[bot\]'/,
  );
  assert.match(
    workflow,
    /github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.user\.login != 'dependabot\[bot\]'/,
  );
  assert.doesNotMatch(workflow, /github\.actor == 'dependabot\[bot\]'/);
  assert.match(workflow, /isolated database credentials are intentionally unavailable/);
});

test("successful production deployments receive an independent smoke gate", async () => {
  const workflow = await readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8");
  const smoke = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");

  assert.match(workflow, /deployment_status/);
  assert.match(workflow, /deployment_status\.state == 'success'/);
  assert.match(workflow, /https:\/\/pickemjb\.vercel\.app/);
  assert.match(workflow, /node scripts\/production-smoke\.mjs/);
  assert.deepEqual(PRODUCTION_SMOKE_PATHS, [
    "/",
    "/api/health",
    "/api/health/automation",
    "/api/health/workers",
    "/api/health/backup",
  ]);
  assert.match(smoke, /Multiple health contracts failed together/);
  assert.match(smoke, /Supabase server authorization/);
});

test("Sentry drops only the confirmed runtime.sendMessage browser noise", async () => {
  const instrumentation = await readFile(new URL("../instrumentation-client.ts", import.meta.url), "utf8");
  const filter = await readFile(new URL("../src/lib/sentry-event-filter.ts", import.meta.url), "utf8");

  assert.match(instrumentation, /beforeSend:\s*prepareBrowserSentryEvent/);
  assert.match(filter, /Invalid call to runtime\.sendMessage\(\)\. Tab not found\./);
  assert.match(filter, /delete event\.user/);
  assert.match(filter, /browserExtensionMessages\.has\(message\)/);
});

test("launch preflight names and rejects the compatibility credential fallback", async () => {
  const admin = await readFile(new URL("../src/lib/supabase-admin.ts", import.meta.url), "utf8");
  const preflight = await readFile(new URL("../src/lib/launch-preflight.ts", import.meta.url), "utf8");

  assert.ok(admin.indexOf("SUPABASE_SERVICE_ROLE_KEY") < admin.indexOf("SUPABASE_SECRET_KEY"));
  assert.match(admin, /supabaseServerCredentialSource/);
  assert.match(admin, /supabaseServerCredentialUsesFallback/);
  assert.match(preflight, /authorized && authoritativeSource/);
  assert.match(preflight, /compatibility fallback/);
});
