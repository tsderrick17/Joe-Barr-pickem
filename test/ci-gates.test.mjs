import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The pull-request gates in the CI workflows: which changed files make a slow check run, what happens when the file list cannot be read, and what the
// Dependabot auto-merge may merge. The path rules are taken from the workflow text itself and applied to sample paths, so the test cannot drift from them.
const read = (name) => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
const [quality, isolated, autoMerge] = await Promise.all([read("quality.yml"), read("isolated-integration.yml"), read("dependabot-auto-merge.yml")]);

function pathRule(workflow) {
  const pattern = workflow.match(/grep -Eq '(\^\([^']+\))'/)?.[1];
  assert.ok(pattern, "the workflow has one path rule");
  return new RegExp(pattern);
}

test("the database run starts for anything the isolated database or its browser flows use, and skips documentation, unit tests and screenshots", () => {
  const runs = pathRule(isolated);
  for (const path of [
    "supabase/migrations/20261031070000_operational_warnings.sql", "src/lib/sync-bowl-pool.ts", "src/app/api/board/route.ts", "src/components/slate-games.tsx",
    "src/app/login/page.tsx", "scripts/season-drill.mjs", "test/integration/season-ladder.test.mjs", "test/e2e/player-flow.spec.ts", "test/helpers/recording-database.mjs",
    "package.json", "package-lock.json", "next.config.ts", ".github/workflows/isolated-integration.yml",
  ]) assert.ok(runs.test(path), `${path} runs the database checks`);
  for (const path of [
    "docs/OPERATIONS.md", "README.md", "test/watchdog-notify.test.mjs", "test/visual/commissioner.visual.spec.ts",
    "test/visual/commissioner.visual.spec.ts-snapshots/commissioner-today-healthy-day-phone-390-linux.png", ".github/workflows/quality.yml", "public/football-spin.webp",
  ]) assert.ok(!runs.test(path), `${path} does not`);
});

test("the screenshot suite still starts for anything a player can see", () => {
  const runs = pathRule(quality);
  for (const path of ["src/components/bowl-card.tsx", "public/sw.js", "test/visual/bowl.visual.spec.ts", "package-lock.json", ".github/workflows/quality.yml"]) assert.ok(runs.test(path), path);
  for (const path of ["docs/DECISION_LOG.md", "supabase/migrations/20261031070000_operational_warnings.sql", "scripts/production-smoke.mjs", "test/watchdog-notify.test.mjs"]) assert.ok(!runs.test(path), path);
});

test("both gates read the changed files from the pull request API, and run everything when that fails or when the event is not a pull request", () => {
  for (const [name, workflow, output] of [["quality", quality, "ui"], ["isolated", isolated, "database"]]) {
    assert.match(workflow, /gh api "repos\/\$REPO\/pulls\/\$PR\/files" --paginate/, `${name} lists files through the API`);
    assert.doesNotMatch(workflow.split("jobs:")[1].split(/\n  (?!changes:)[a-z-]+:\n/)[0], /actions\/checkout/, `${name}: the file check downloads no history`);
    assert.match(workflow, new RegExp(`if \\[ "\\$EVENT" != "pull_request" \\]; then echo "${output}=true"`), `${name}: pushes and scheduled runs always run`);
    assert.match(workflow, new RegExp(`could not be listed[\\s\\S]*?echo "${output}=true"`), `${name}: an unreadable file list runs the checks`);
  }
});

test("the required database check is only skipped when the file check said so, never because the file check failed", () => {
  const condition = isolated.match(/database-lifecycle:\s+needs: changes[\s\S]*?\n\s+if: \$\{\{ (.+) \}\}/)?.[1];
  assert.ok(condition, "database-lifecycle waits for the file check");
  assert.match(condition, /!cancelled\(\)/);
  assert.match(condition, /needs\.changes\.outputs\.database != 'false'/);
  assert.match(condition, /github\.event\.pull_request\.user\.login != 'dependabot\[bot\]'/, "Dependabot still never receives the isolated credentials");
});

test("Dependabot auto-merge asks GitHub to merge, only for patch updates of npm packages, and runs no repository code", () => {
  assert.match(autoMerge, /github\.event\.pull_request\.user\.login == 'dependabot\[bot\]'/);
  assert.match(autoMerge, /\.updateType == "version-update:semver-patch" and \.packageEcosystem == "npm_and_yarn"/);
  assert.match(autoMerge, /all\(\.\[\];/, "every dependency in a grouped pull request must qualify");
  assert.match(autoMerge, /gh pr merge --auto --squash/, "GitHub merges when the required checks pass; this never merges directly");
  assert.doesNotMatch(autoMerge, /gh pr merge(?! --auto)/);
  assert.doesNotMatch(autoMerge, /actions\/checkout/, "no pull request code runs with write access");
  assert.doesNotMatch(autoMerge, /pull_request_target/);
});
