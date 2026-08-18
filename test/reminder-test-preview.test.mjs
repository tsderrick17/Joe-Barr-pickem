import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Commissioner can preview the selections reminder without emailing the pool", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../src/app/admin/reminders/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/reminders/test/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Preview selections email/);
  assert.match(page, /test\("selections"\)/);
  assert.match(route, /selectionTemplate\?\.title \|\| "Selections still to be made"/);
  assert.match(route, /selectionTemplate\?\.body \|\| "A friendly reminder/);
  assert.match(route, /deliverEmailTest\(reminder, commissioner\.id, player\.notification_email\)/);
  assert.doesNotMatch(route, /eligiblePlayerIds/);
});
