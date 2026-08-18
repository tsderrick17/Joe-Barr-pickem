import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("monthly rehearsal retries its latest Supabase CLI installation", async () => {
  const workflow = await readFile(new URL("../.github/workflows/monthly-upgrade-rehearsal.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /uses: supabase\/setup-cli@v2/);
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.match(workflow, /npm install --no-save --no-package-lock supabase@latest/);
  assert.match(workflow, /npx --no-install supabase db push/);
});
