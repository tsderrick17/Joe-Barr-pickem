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
