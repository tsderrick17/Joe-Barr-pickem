import assert from "node:assert/strict";
import test from "node:test";
import { readStylesheetSync } from "./helpers/stylesheet.mjs";


test("desktop Slate picker names cannot push final scores away", () => {
  const css = readStylesheetSync();
  const desktopPickerBlock = css.match(/\.slate-game-row\.is-final \.slate-team-picker-list\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const pickerBlock = css.match(/(?:^|\n)\.slate-team-picker-list\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  // The names live in their own row spanning a flexible track, so they never size the score columns.
  assert.match(desktopPickerBlock, /grid-column:\s*1 \/ -1;/);
  assert.match(desktopPickerBlock, /grid-row:\s*2;/);
  assert.match(pickerBlock, /overflow-wrap:\s*break-word;/);
  assert.doesNotMatch(pickerBlock, /overflow-wrap:\s*anywhere;/);
});
