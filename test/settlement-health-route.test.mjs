import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("settlement freshness health contract allows a bounded grading grace window", async () => {
  const source = await readFile(new URL("../src/app/api/health/settlement/route.ts", import.meta.url), "utf8");
  assert.match(source, /SETTLEMENT_GRACE_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(source, /status: \"unavailable\"/);
  assert.match(source, /Cache-Control.*no-store/);
  assert.match(source, /postponed.*cancelled.*no_contest/);
});
