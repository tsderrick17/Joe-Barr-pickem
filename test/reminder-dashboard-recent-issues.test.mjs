import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("reminder dashboard limits its warning count to recent delivery issues", async () => {
  const page = await readFile(new URL("../src/app/admin/reminders/page.tsx", import.meta.url), "utf8");
  assert.match(page, /setRecentIssueCutoff\(Date\.now\(\) - 7 \* 24 \* 60 \* 60 \* 1000\)/);
  assert.match(page, /RECENT DELIVERY ISSUES/);
  assert.match(page, /Failed sends in the past 7 days/);
});
