import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Slate hydrates the per-player Pool Action preference on initial load and week changes", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");
  assert.equal(source.match(/setShowActionOnly\(Boolean\(data\.showPoolAction\)\)/g)?.length, 2);
  assert.match(source, /setGames\(data\.games\);\s*\/\/ Apply the player's durable display choice[\s\S]*setShowActionOnly\(Boolean\(data\.showPoolAction\)\);/);
});
