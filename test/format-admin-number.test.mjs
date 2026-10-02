import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatAdminNumber } from "../src/lib/format-admin-number.js";

test("missing admin measurements never crash number formatting", async () => {
  assert.equal(formatAdminNumber(undefined), "—");
  assert.equal(formatAdminNumber(null), "—");
  assert.equal(formatAdminNumber(Number.NaN), "—");
  assert.equal(formatAdminNumber(1234), "1,234");
  assert.equal(formatAdminNumber(1.25, { maximumFractionDigits: 1 }), "1.3");

  const panels = await Promise.all([
    "efficiency-trend-panel.tsx",
    "slate-performance-panel.tsx",
    "grading-dashboard.tsx",
    "account-capacity.tsx",
    "automation-health.tsx",
  ].map((name) => readFile(new URL(`../src/components/${name}`, import.meta.url), "utf8")));
  for (const panel of panels) assert.match(panel, /formatAdminNumber\(/);
});
