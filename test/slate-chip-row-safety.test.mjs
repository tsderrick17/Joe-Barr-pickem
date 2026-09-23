import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("survivor chip lanes reserve space for the chip footprint", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.slate-survivor-chip-slot \{ min-height: 3\.85rem; \}/);
  assert.match(css, /\.slate-survivor-chip-slot \{ min-height: 4\.7rem; \}/);
  assert.match(css, /\.slate-survivor-chip-button \{[\s\S]*height: 3\.79rem;[\s\S]*width: 3\.79rem;/);
  assert.match(css, /\.slate-survivor-chip-button \{[\s\S]*height: 3\.24rem;/);
  assert.match(css, /\.slate-game-row\.has-survivor-layout \.slate-spread-cell \{[\s\S]*transform: none;[\s\S]*z-index: 2;/);
});
