import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const workflow = await readFile(
  new URL("../.github/workflows/supabase-isolated-migrations.yml", import.meta.url),
  "utf8",
);
const dependabot = await readFile(
  new URL("../.github/dependabot.yml", import.meta.url),
  "utf8",
);

test("isolated migration workflow uses one complete connection secret", () => {
  assert.match(workflow, /PICKEM_TEST_DATABASE_URL: \$\{\{ secrets\.PICKEM_TEST_DATABASE_URL \}\}/);
  assert.doesNotMatch(workflow, /PICKEM_TEST_DB_PASSWORD/);
  assert.doesNotMatch(workflow, /\$TEST_DATABASE_URL/);
  assert.match(workflow, /supabase db push --db-url "\$PICKEM_TEST_DATABASE_URL" --dry-run --include-all/);
  assert.match(workflow, /psql "\$PICKEM_TEST_DATABASE_URL" -tAc/);
  assert.match(workflow, /supabase db push --db-url "\$PICKEM_TEST_DATABASE_URL" --include-all/);
});

test("Dependabot checks both application packages and GitHub Actions weekly", () => {
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /interval: weekly/);
});

test("the isolated workflow keeps the Supabase CLI's container images, keyed on the CLI version it installs", async () => {
  const integration = await readFile(new URL("../.github/workflows/isolated-integration.yml", import.meta.url), "utf8");
  const version = integration.match(/supabase\/setup-cli@v\d+\s+with:\s+version: ([\d.]+)/)?.[1];
  assert.ok(version, "the CLI version is pinned");
  const keys = [...integration.matchAll(/key: supabase-cli-images-([\d.]+)/g)].map((match) => match[1]);
  assert.equal(keys.length, 2, "restored and saved under the same key");
  assert.ok(keys.every((key) => key === version), "a new CLI version starts a new cache");
});

test("Playwright is upgraded on purpose: Dependabot leaves it alone, and the package and both container tags are one version", async () => {
  const dependabotText = await readFile(new URL("../.github/dependabot.yml", import.meta.url), "utf8");
  assert.match(dependabotText, /dependency-name: "@playwright\/test"[\s\S]*?version-update:semver-minor/);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const wanted = String(pkg.devDependencies["@playwright/test"]).replace(/^[^\d]*/, "");
  for (const file of ["quality.yml", "visual-baselines.yml"]) {
    const text = await readFile(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8");
    const tag = text.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/)?.[1];
    assert.equal(tag, wanted, `${file}: container tag ${tag} must match @playwright/test ${wanted}`);
  }
});
