import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Slate email artwork prioritizes readable mobile columns", async () => {
  const source = await readFile(new URL("../src/lib/email-artwork.tsx", import.meta.url), "utf8");

  assert.match(source, /const WIDTH = 760/);
  assert.match(source, /slateImagePresentation/);
  assert.match(source, /width: 110/);
});
