import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRODUCTION_SMOKE_PATHS } from "../scripts/production-smoke.mjs";

test("eligible pull requests run the real isolated browser flow", async () => {
  const workflow = await readFile(new URL("../.github/workflows/isolated-integration.yml", import.meta.url), "utf8");
  const config = await readFile(new URL("../playwright.config.ts", import.meta.url), "utf8");

  assert.match(workflow, /PICKEM_E2E_ENABLED:\s*"true"/);
  assert.match(workflow, /PICKEM_TEST_SUPABASE_URL/);
  assert.match(workflow, /PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(workflow, /PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /playwright install (?:--with-deps )?chromium/);
  assert.match(config, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("Dependabot pull requests never receive isolated database credentials", async () => {
  const workflow = await readFile(new URL("../.github/workflows/isolated-integration.yml", import.meta.url), "utf8");

  assert.match(workflow, /database-lifecycle:[\s\S]*?concurrency:\s*\n\s+group:\s*isolated-integration-shared-database/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.doesNotMatch(workflow, /^concurrency:/m);
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

  assert.match(workflow, /group:\s*production-smoke-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /deployment_status/);
  assert.match(workflow, /deployment_status\.state == 'success'/);
  assert.match(workflow, /https:\/\/pickemjb\.vercel\.app/);
  assert.match(workflow, /node scripts\/production-smoke\.mjs/);
  assert.deepEqual(PRODUCTION_SMOKE_PATHS, [
    "/",
    "/board",
    "/bowl-pool",
    "/football-spin.webp",
    "/api/health",
    "/api/health/automation",
    "/api/health/workers",
    "/api/health/backup",
    "/api/health/bowl-pool",
  ]);
  assert.match(smoke, /Multiple health contracts failed together/);
  assert.match(smoke, /Supabase server authorization/);
  assert.match(smoke, /PICKEM_SMOKE_RECAP_REMINDER_ID/);
  assert.match(smoke, /contentType\.startsWith\("image\/"\)/);
});

test("a newer PR commit cancels only the prior quality run for that PR", async () => {
  const workflow = await readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");

  assert.match(workflow, /group:\s*application-quality-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
});
