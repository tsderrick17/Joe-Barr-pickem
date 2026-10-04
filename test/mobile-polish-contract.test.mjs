import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("worker activity outranks the dashboard's table rules and stacks into cards on a phone", async () => {
  const css = await read("src/app/globals.css");
  const prefix = String.raw`\[aria-labelledby="grading-dashboard-title"\] table\.grading-worker-table:not\(\.provider-chart-table\)`;
  assert.match(css, new RegExp(`${prefix} tbody td:nth-child\(2\) \{ border-radius: 0;`));
  assert.match(css, new RegExp(String.raw`@media \(max-width: 639px\) \{\s*${prefix},`));
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

test("the playoff ledger spans the pad from tablet width up", async () => {
  const css = await read("src/app/globals.css");
  assert.match(css, /@media \(min-width: 640px\) \{\s*\.playoff-scoreboard \.pickem-ledger-grid \{ width: 100%; \}/);
});
