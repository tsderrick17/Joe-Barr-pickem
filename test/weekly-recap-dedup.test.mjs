import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("weekly recap scheduling treats any existing recap record as a safe no-op", async () => {
  const source = await readFile(new URL("../src/lib/automatic-weekly-recap.ts", import.meta.url), "utf8");
  assert.match(source, /\.eq\("category", "weekly_recap"\)[\s\S]*?\.limit\(1\)[\s\S]*?\.maybeSingle\(\)/);
  assert.match(source, /if \(existing\) return \{ created: false, reason: "already_queued" \}/);
});
