import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("desktop Slate picker names cannot push final scores away", () => {
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  assert.match(css, /\.slate-game-row\.is-final \.slate-team-picker-list\s*\{[\s\S]*max-width:\s*12ch;/);
  assert.match(css, /\.slate-team-picker-list\s*\{[\s\S]*overflow-wrap:\s*break-word;/);
  assert.doesNotMatch(css, /\.slate-team-picker-list\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
});
