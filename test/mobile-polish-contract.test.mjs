import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("worker activity outranks the dashboard's table rules and stacks into cards on a phone", async () => {
  const css = await read("src/app/globals.css");
  const prefix = '[aria-labelledby="grading-dashboard-title"] table.grading-worker-table:not(.provider-chart-table)';
  assert.ok(css.includes(`${prefix} tbody td:nth-child(2) { border-radius: 0;`));
  assert.match(css, /@media \(max-width: 639px\) \{\s+\[aria-labelledby="grading-dashboard-title"\] table\.grading-worker-table/);
  assert.match(css, /content: "Started  "/);
  assert.match(css, /content: "Finished  "/);
  assert.doesNotMatch(css, /^\[aria-labelledby="grading-dashboard-title"\] \.grading-worker-table /m);
});

test("the test coin lands exactly where it started", async () => {
  const source = await read("src/components/chip-playground.tsx");
  assert.match(source, /const to = \{ x: from\.x \+ 1080, y: from\.y \};/);
  assert.doesNotMatch(source, /Math\.round\(from\./);
});

test("chip edge segments shade smoothly into their neighbors", async () => {
  const [chip, css] = await Promise.all([read("src/components/survivor-poker-chip.tsx"), read("src/app/globals.css")]);
  assert.match(chip, /"--seg-dark-a": edgeDark\(angle - span \/ 2\)/);
  assert.match(chip, /"--seg-dark-b": edgeDark\(angle \+ span \/ 2\)/);
  assert.equal((css.match(/linear-gradient\(90deg, rgba\(16,14,12,var\(--seg-dark-a\)\), rgba\(16,14,12,var\(--seg-dark-b\)\)\)/g) ?? []).length, 2);
});

test("the playoff ledger hugs its picks from tablet width up instead of stretching", async () => {
  const css = await read("src/app/globals.css");
  assert.match(css, /\.playoff-scoreboard \{ margin-left: auto; margin-right: auto; max-width: 100%; width: fit-content; \}/);
  assert.match(css, /\.playoff-scoreboard \.pickem-ledger-grid \{ min-width: 0; width: auto; \}/);
  assert.match(css, /td\.playoff-scoreboard-pick \{ padding-left: 0; padding-right: clamp\(\.35rem, 2\.4vw - \.7rem, 1\.25rem\); white-space: nowrap; \}/);
});
