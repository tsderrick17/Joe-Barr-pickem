import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Bowl Pool sticky identity cells use the same warm row colors as the standings", async () => {
  const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.ok(page.includes('const rowFill = rowIndex % 2 ? "is-alt bg-[#f3f0e8]" : "bg-[#fffdf8]"'));
  assert.ok(!page.includes("is-alt bg-[#e9eef4]"));
});

test("mobile Survivor chip lanes and chip artwork scale together", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.slate-game-row\.has-survivor-layout\s*\{\s*grid-template-columns:\s*2\.3rem minmax\(0, 1fr\) 2\.7rem 2\.45rem 2\.7rem minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 379px\)\s*\{[\s\S]*?grid-template-columns:\s*2rem minmax\(0, 1fr\) 2\.4rem 2\.2rem 2\.4rem minmax\(0, 1fr\)[\s\S]*?height:\s*2\.1rem/);
  assert.match(css, /\.slate-game-row\.no-survivor-layout\.is-final\s*\{\s*grid-template-columns:\s*2rem minmax\(0, 1fr\) 3rem minmax\(0, 1fr\) 2rem/);
  assert.match(css, /\.slate-game-row\.no-survivor-layout\.is-final \.slate-team-result-mark \{ font-size: \.75rem; \}/);
});
