import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the receipt's warning tab has the same die-cut corners as the sections above it", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.slate-receipt-ticket::before,\s*\.slate-receipt-pool::before,\s*\.slate-receipt-warning::before \{/);
  assert.match(css, /\.slate-receipt-pool::before,\s*\.slate-receipt-warning::before \{\s*-webkit-mask-image: var\(--receipt-bite-top-left\)/);
});
