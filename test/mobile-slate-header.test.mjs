import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("stacked Slate header removes its empty control lane and redundant separator space", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /actionSwitchAvailable \? \(\s*<div className="slate-view-switch-slot">/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.slate-header-grid \{ gap: \.55rem; \}/);
  assert.match(styles, /\.slate-header-grid > aside \{\s*border-top: 0;\s*padding-top: 0;/);
});
