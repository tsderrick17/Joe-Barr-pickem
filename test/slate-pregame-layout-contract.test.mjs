import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("pregame rows reclaim unused Survivor lanes while final phone rows use compact rails", async () => {
  const component = await readFile(new URL("../src/components/slate-game-row.tsx", import.meta.url), "utf8");
  const css = await readStylesheet();

  assert.match(component, /no-survivor-layout/);
  assert.match(css, /\.slate-game-row\.no-survivor-layout:not\(\.is-final\)/);
  assert.match(css, /grid-template-columns:\s*4\.5rem minmax\(0, 1fr\) 6\.5rem minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns:\s*3\.15rem minmax\(0, 1fr\) 3\.75rem minmax\(0, 1fr\)/);
  assert.match(css, /\.slate-game-row\.no-survivor-layout\.is-final\s*\{\s*grid-template-columns:\s*2rem minmax\(0, 1fr\) 3rem minmax\(0, 1fr\) 2rem/);
  assert.match(css, /\.slate-game-row\.no-survivor-layout\.is-final \.slate-team-result-mark/);
});

test("phone rows without Survivor chips keep the spread and lock note out of the team names", async () => {
  const css = await readStylesheet();
  const phone = css.slice(css.indexOf("@media (max-width: 767px) {\n  .slate-game-row.no-survivor-layout:not(.is-final) {".replace(/\n/g, css.includes("\r\n") ? "\r\n" : "\n")));
  const block = phone.slice(0, phone.indexOf("\n}") + 2);
  // The kickoff time is its own lane on phones, and no sideways nudge exists to undo.
  assert.doesNotMatch(block, /\.slate-spread-cell \{\s*transform:/);
  assert.match(block, /\.slate-game-row\.no-survivor-layout:not\(\.is-final\) \.slate-spread-cell > p \{\s*white-space: normal;/);
});

test("the early-lock note is two short lines, day then time, centered under the spread", async () => {
  const component = await readFile(new URL("../src/components/slate-game-row.tsx", import.meta.url), "utf8");
  const css = await readStylesheet();
  assert.match(component, /function easternLockParts\(value: string\)/);
  assert.match(component, /<p className="slate-lock-note [^"]*"><span>LOCKS \{easternLockParts\(game\.lineLockAt\)\.date\}<\/span><span>\{easternLockParts\(game\.lineLockAt\)\.time\}<\/span><\/p>/);
  // Slate times carry no "ET" suffix.
  assert.match(component, /time: time\.replace\(":00", ""\)\.toUpperCase\(\)/);
  assert.match(css, /\.slate-lock-note \{ display: grid; justify-items: center; white-space: nowrap; \}/);
});
