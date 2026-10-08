import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { measureAllRoutes } from "./helpers/measure-all-routes.mjs";

const budgets = JSON.parse(await readFile(new URL("./route-cost-budgets.json", import.meta.url), "utf8")).budgets;
const results = await measureAllRoutes();

test("every measured route read succeeds in every scenario", () => {
  assert.deepEqual(Object.keys(results).sort(), Object.keys(budgets).sort(), "each scenario has a budget and each budget a scenario");
  for (const [name, result] of Object.entries(results)) assert.equal(result.status, 200, name);
});

test("no route read exceeds its request, row, database-byte or response-byte budget", () => {
  for (const [name, result] of Object.entries(results)) {
    for (const metric of ["requests", "rows", "databaseBytes", "responseBytes"]) {
      assert.ok(result[metric] <= budgets[name][metric], `${name}: ${metric} is ${result[metric]}, over the budget of ${budgets[name][metric]}. If this is intended, raise the budget in test/route-cost-budgets.json and say why in docs/DECISION_LOG.md.`);
    }
  }
});

test("older seasons on file add nothing to a read: history is scoped to the current season", () => {
  for (const route of ["home", "board"]) {
    const { requests, rows, databaseBytes } = results[`${route}/multi_season`];
    const baseline = results[`${route}/late_regular`];
    assert.deepEqual({ requests, rows, databaseBytes }, { requests: baseline.requests, rows: baseline.rows, databaseBytes: baseline.databaseBytes }, route);
  }
});

test("the Standings read stays narrow: this week's picks plus only the winning picks' player ids, never the whole season", () => {
  const late = results["home/late_regular"];
  const picks = late.byTable["select:picks"];
  // Two reads (this week's picks, and the season's wins). Loading every pick of the season took about 64 KB here.
  assert.equal(picks.requests, 2);
  assert.ok(picks.bytes < 20_000, `the picks reads are ${picks.bytes} bytes; the whole-season read was about 64,000`);
  assert.ok(picks.bytes < late.databaseBytes * 0.6, "the picks reads are no longer most of the route's database traffic");
});

test("a read makes no write on the player's behalf beyond the activity timestamp", () => {
  for (const [name, result] of Object.entries(results)) {
    const writes = Object.keys(result.byTable).filter((key) => /^(insert|update|upsert|delete):/.test(key));
    assert.ok(writes.every((key) => key === "update:players"), `${name}: ${writes.join(", ")}`);
  }
});
