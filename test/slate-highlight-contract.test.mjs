import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("selected Slate highlight stays sized to the team label", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const selectedBlock = css.match(/\.slate-team-label--selected\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const markerBlock = css.match(/\.slate-team-label--selected::before\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(selectedBlock, /display:\s*inline-block/);
  assert.match(selectedBlock, /width:\s*fit-content/);
  assert.match(selectedBlock, /max-width:\s*100%/);
  assert.doesNotMatch(markerBlock, /width:\s*100%/);
  assert.match(css, /\.slate-game-row\.is-final \.slate-team-label\s*\{\s*white-space:\s*nowrap/);
});

test("final Slate scores use the team-name size and a stable numeric anchor", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const scoreBlock = css.match(/\.slate-team-score\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(scoreBlock, /font-size:\s*1em/);
  assert.match(scoreBlock, /font-weight:\s*800/);
  assert.match(scoreBlock, /min-width:\s*2\.3ch/);
  assert.match(scoreBlock, /text-align:\s*right/);
  assert.match(scoreBlock, /align-self:\s*start/);
  assert.match(css, /\.slate-team-result-mark\s*\{\s*align-self:\s*start/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, max-content\) 2\.3ch max-content/);
});

test("final Slate team text groups stay vertically centered as one unit", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.match(css, /\.slate-game-row\.is-final > \.slate-team-side\s*\{[\s\S]*justify-content:\s*center/);
  assert.match(css, /\.slate-game-row\.is-final > \.slate-team-side > \.slate-final-team-stack\s*\{[\s\S]*align-self:\s*center/);
  assert.doesNotMatch(css, /\.slate-game-row\.is-final > \.slate-team-side:has\(/);
});
