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

test("monthly rehearsal runs once on the first available non-gameday", async () => {
  const workflow = await readFile(new URL("../.github/workflows/monthly-upgrade-rehearsal.yml", import.meta.url), "utf8");
  assert.match(workflow, /cron: "23 15 1-10 \* \*"/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /select-upgrade-rehearsal-date\.mjs/);
  assert.match(workflow, /monthly-upgrade-rehearsal-complete-\$\{\{ steps\.month\.outputs\.month_key \}\}/);
  assert.match(workflow, /if: success\(\) && steps\.calendar\.outputs\.run == 'true'/);
});
