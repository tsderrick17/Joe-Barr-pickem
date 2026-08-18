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
