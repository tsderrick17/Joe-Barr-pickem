import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("initial Slate bootstrap is bounded and cancelled when its page unmounts", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const BOARD_LOAD_TIMEOUT_MS = 15_000;/);
  assert.match(source, /const request = new AbortController\(\);[\s\S]*?setTimeout\(\(\) => request\.abort\(\), BOARD_LOAD_TIMEOUT_MS\)/);
  assert.match(source, /fetchWithSession\(`\/api\/board\?\$\{params\}`, \{ signal: request\.signal \}\)/);
  assert.match(source, /return \(\) => \{\s+disposed = true;\s+window\.clearTimeout\(requestTimer\);\s+request\.abort\(\);/);
  assert.match(source, /catch \(error\) \{\s+if \(disposed\) return;\s+if \(error instanceof SessionUnavailableError\)/);
});
