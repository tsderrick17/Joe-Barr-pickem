import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Slate email artwork prioritizes readable mobile columns", async () => {
  const source = await readFile(new URL("../src/app/api/recap-image/route.tsx", import.meta.url), "utf8");

  assert.match(source, /const SLATE_IMAGE_WIDTH = 920;/);
  assert.match(source, /width: singleGame \? 120 : 108/);
  assert.match(source, /justifyContent: singleGame \? "center" : "flex-start"/);
  assert.match(source, /width: SLATE_IMAGE_WIDTH/);
});
