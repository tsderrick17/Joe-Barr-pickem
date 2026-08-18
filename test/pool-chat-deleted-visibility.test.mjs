import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("deleted pool-chat notes stay out of every live chat view", async () => {
  const route = await readFile(new URL("../src/app/api/pool-chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /query = query\.is\("deleted_at", null\)/);
  assert.doesNotMatch(route, /if \(!viewer\.is_commissioner\) query = query\.is\("deleted_at", null\)/);
});
