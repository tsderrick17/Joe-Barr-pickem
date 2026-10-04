import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every Bowl Card table line is one single 1px old-gold rule", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf("/* ---- Bowl Card: one line style for the whole table."));
  assert.match(block, /\.grid > span \{ border-width: 0 !important; \}/);
  assert.match(block, /border-left: 1px solid var\(--bowl-gold\) !important;/);
  assert.match(block, /\.bowl-standings-player-row \{ border-width: 0 0 1px !important; border-style: solid !important; border-color: var\(--bowl-gold\) !important; \}/);
  // The older double-width day dividers are gone.
  assert.doesNotMatch(css, /border-(?:left|right)-width: 2px !important/);
});

test("Bowl Card spreads drop the minus sign, since the favorite is always on top", async () => {
  const source = await readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8");
  assert.match(source, /\{bowlSpreadLabel\(game\.line\?\.locked_spread\)\}/);
  assert.ok(source.includes('return String(spread).replace(/^[-−]\\s*/, "");'));
});
