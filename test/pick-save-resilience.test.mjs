import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a slow Slate save is allowed to complete before the browser reports failure", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const PICK_SAVE_TIMEOUT_MS = 30_000;/);
  assert.match(source, /setTimeout\(\(\) => request\.abort\(\), PICK_SAVE_TIMEOUT_MS\)/);
  assert.match(source, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
});
