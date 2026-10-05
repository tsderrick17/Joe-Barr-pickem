import assert from "node:assert/strict";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("the receipt's warning tab has the same die-cut corners as the sections above it", async () => {
  const css = await readStylesheet();
  assert.match(css, /\.slate-receipt-ticket::before,\s*\.slate-receipt-pool::before,\s*\.slate-receipt-warning::before \{/);
  assert.match(css, /\.slate-receipt-pool::before,\s*\.slate-receipt-warning::before \{\s*-webkit-mask-image: var\(--receipt-bite-top-left\)/);
});
