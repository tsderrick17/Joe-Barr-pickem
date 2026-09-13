import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("survivor chip lanes reserve space for the chip footprint", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.slate-survivor-chip-slot \{ min-height: 3\.2rem; \}/);
  assert.match(css, /\.slate-survivor-chip-slot \{ min-height: 3\.9rem; \}/);
});
