import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { measure } from "../scripts/css-report.mjs";

// The stylesheet's messiness may only go down. Lower the numbers in
// test/stylesheet-budget.json whenever a change reduces them; never raise them.
// See `node scripts/css-report.mjs` for where each count comes from.
test("the stylesheet stays within its budget", async () => {
  const budget = JSON.parse(await readFile(new URL("./stylesheet-budget.json", import.meta.url), "utf8"));
  const { totals } = measure();
  for (const [metric, limit] of Object.entries(budget)) {
    assert.ok(totals[metric] <= limit, `${metric} is ${totals[metric]}, over the budget of ${limit}. Edit the rule where it lives instead of adding another (see scripts/css-report.mjs).`);
  }
});
