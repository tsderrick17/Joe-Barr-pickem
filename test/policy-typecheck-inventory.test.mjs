import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the policy typecheck inventory is unique and its documented counts stay current", async () => {
  const [configSource, architecture, plan] = await Promise.all([
    read("tsconfig.policy.json"),
    read("docs/ARCHITECTURE_MAP.md"),
    read("docs/CODEBASE_IMPROVEMENT_PLAN.md"),
  ]);
  const modulePaths = JSON.parse(configSource).include;
  assert.equal(new Set(modulePaths).size, modulePaths.length, "policy typecheck entries must not be duplicated");

  const architectureCount = architecture.match(/checks (\d+) JavaScript policy\s+modules/)?.[1];
  const planCount = plan.match(/policy check now covers (\d+)\s+JavaScript\s+modules/)?.[1];
  assert.ok(architectureCount, "architecture map should document the policy module count");
  assert.ok(planCount, "improvement plan should document the policy module count");
  assert.equal(Number(architectureCount), modulePaths.length);
  assert.equal(Number(planCount), modulePaths.length);
});
