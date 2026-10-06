import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the privileged Supabase client is blocked from Client Component imports", async () => {
  const source = await readFile(new URL("../src/lib/supabase-admin.ts", import.meta.url), "utf8");
  assert.match(source, /^import ["']server-only["'];/m);
});
