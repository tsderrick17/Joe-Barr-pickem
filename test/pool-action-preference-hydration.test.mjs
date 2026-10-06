import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Slate hydrates the per-player Pool Action preference on initial load and week changes", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");
  // One shared function applies a board response, on the first load and on every week change.
  assert.equal(source.match(/setShowActionOnly\(showActionOnlyOverride\.current \?\? Boolean\(data\.showPoolAction\)\)/g)?.length, 1);
  assert.equal(source.match(/applyBoard\(data\)/g)?.length, 2);
  assert.match(source, /function applyBoard[\s\S]*setShowActionOnly\(showActionOnlyOverride\.current \?\? Boolean\(data\.showPoolAction\)\);/);
});

test("a week refresh cannot undo an optimistic Pool Action choice while its save is in flight", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");

  assert.match(source, /showActionOnlyOverride = useRef<boolean \| null>\(null\)/);
  assert.match(source, /setShowActionOnly\(showActionOnlyOverride\.current \?\? Boolean\(data\.showPoolAction\)\)/);
  const toggle = source.slice(source.indexOf("const toggleDisplay = useStableCallback"), source.indexOf("async function chooseWeek"));
  assert.match(toggle, /showActionOnlyOverride\.current = next;[\s\S]*setShowActionOnly\(next\);[\s\S]*fetchWithSession/);
  assert.match(toggle, /catch\(\(\) => \{[\s\S]*showActionOnlyOverride\.current = previous;[\s\S]*setShowActionOnly\(previous\)/);
  assert.match(toggle, /finally\(\(\) => \{\s+setIsSavingDisplayPreference\(false\);/);
  const header = await readFile(new URL("../src/components/slate-header.tsx", import.meta.url), "utf8");
  assert.match(header, /disabled=\{isSavingDisplayPreference\}/);
});
