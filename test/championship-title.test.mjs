import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { championshipTitle } = await import("../src/lib/championship-title.ts");

test("a trophy title names the season as it is played, the pool, and Champion or Co-Champion", () => {
  assert.equal(championshipTitle(2025, "Bowl Pool", false), "'25-26 Bowl Pool Champion");
  assert.equal(championshipTitle(2025, "Survivor", true), "'25-26 Survivor Co-Champion");
  assert.equal(championshipTitle(2026, "Pick'em", false), "'26-27 Pick'em Champion");
  assert.equal(championshipTitle(2099, "Bowl Pool", false), "'99-00 Bowl Pool Champion", "the second year rolls past the century");
});
