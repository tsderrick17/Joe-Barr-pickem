import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pregame rows reclaim unused Survivor lanes without changing finals", async () => {
  const component = await readFile(new URL("../src/components/slate-game-row.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(component, /no-survivor-layout/);
  assert.match(css, /\.slate-game-row\.no-survivor-layout:not\(\.is-final\)/);
  assert.match(css, /grid-template-columns:\s*4\.5rem minmax\(0, 1fr\) 6\.5rem minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns:\s*3\.15rem minmax\(0, 1fr\) 3\.35rem minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /\.slate-game-row\.no-survivor-layout\.is-final/);
});
