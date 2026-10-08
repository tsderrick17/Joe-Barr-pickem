import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("every Bowl Card table line is one single 1px old-gold rule", async () => {
  const css = await readStylesheet();
  const block = css.slice(css.indexOf("/* ---- Bowl Card: one line style for the whole table."));
  assert.match(block, /\.grid > span \{ border-width: 0; \}/);
  assert.match(block, /border-left: 1px solid var\(--bowl-gold\);/);
  assert.match(block, /\.bowl-standings-player-row \{ border-width: 0 0 1px !important; border-style: solid !important; border-color: var\(--bowl-gold\) !important; \}/);
  // The older double-width day dividers are gone.
  assert.doesNotMatch(css, /border-(?:left|right)-width: 2px/);
});

test("Bowl Card spreads drop the minus sign, since the favorite is always on top", async () => {
  const source = await readFile(new URL("../src/components/bowl-card.tsx", import.meta.url), "utf8");
  assert.match(source, /\{bowlSpreadLabel\(game\.line\?\.locked_spread\)\}/);
  assert.ok(source.includes('return String(spread).replace(/^[-−]\\s*/, "");'));
});

test("a live Slate row takes the final layout and its badge fits the date column", async () => {
  const [row, css] = await Promise.all([
    readFile(new URL("../src/components/slate-game-row.tsx", import.meta.url), "utf8"),
    readStylesheet(),
  ]);
  assert.match(row, /const settledLayout = isFinal \|\| isLive;/);
  assert.match(row, /\$\{settledLayout \? "is-final" : ""\} \$\{isLive \? "is-live" : ""\}/);
  assert.match(css, /\.slate-live-badge \{ max-width: 100%; white-space: nowrap; \}/);
});

test("a settled row's spread is level with the team names", async () => {
  const css = await readStylesheet();
  assert.match(css, /\.slate-game-row\.is-final\.has-survivor-layout \.slate-spread-cell \{ margin-top: \.64rem; \}/);
  assert.match(css, /\.slate-game-row\.is-final\.no-survivor-layout \.slate-spread-cell \{ margin-top: -\.2rem; \}/);
});
