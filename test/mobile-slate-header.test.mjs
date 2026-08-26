import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("stacked Slate header removes its empty control lane and redundant separator space", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<div className="slate-view-switch-slot">/);
  assert.doesNotMatch(page, /actionSwitchAvailable/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*?\.slate-header-grid \{ gap: \.55rem; \}/);
  assert.match(styles, /\.slate-header-grid > aside \{\s*border-top: 0;\s*padding-top: 0;/);
  assert.match(styles, /\.slate-view-switch \{[\s\S]*?display: inline-grid;[\s\S]*?grid-template-columns: 2\.82rem 1\.62rem 2\.82rem;/);
  assert.match(styles, /\.slate-view-switch button \{[\s\S]*?position: relative;/);
});
