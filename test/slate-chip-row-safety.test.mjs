import assert from "node:assert/strict";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("survivor chip lanes reserve space for the chip footprint", async () => {
  const css = await readStylesheet();
  assert.match(css, /\.slate-survivor-chip-slot \{[^}]*min-height: 3\.85rem;[^}]*\}/);
  assert.match(css, /\.slate-survivor-chip-slot \{ min-height: 4\.7rem; \}/);
  assert.match(css, /\.slate-survivor-chip-button \{[\s\S]*height: 3\.79rem;[\s\S]*width: 3\.79rem;/);
  assert.match(css, /\.slate-survivor-chip-button \{[\s\S]*height: 3\.24rem;/);
  assert.match(css, /\.slate-game-row\.has-survivor-layout \.slate-spread-cell \{[\s\S]*position: relative;[\s\S]*z-index: 2;/);
  // The spread is a real grid column; nothing nudges it sideways.
  assert.doesNotMatch(css, /\.slate-spread-cell \{[^}]*transform:/);
});
