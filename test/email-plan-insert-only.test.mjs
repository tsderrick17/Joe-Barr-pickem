import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("automatic email planning inserts only missing occurrences without a partial-index upsert", async () => {
  const source = await readFile(new URL("../src/lib/automatic-email-plan.ts", import.meta.url), "utf8");
  assert.match(source, /const missingRows = rows\.filter\(\(row\) => !existingKeys\.has\(row\.automation_key\)\)/);
  assert.match(source, /\.insert\(missingRows\)/);
  assert.doesNotMatch(source, /\.upsert\(rows, \{ onConflict: "automation_key"/);
  assert.match(source, /error\?\.code === "23505"/);
});
