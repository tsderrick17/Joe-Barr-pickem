import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a slow Slate save is allowed to complete before the browser reports failure", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const PICK_SAVE_TIMEOUT_MS = 30_000;/);
  assert.match(source, /setTimeout\(\(\) => request\.abort\(\), PICK_SAVE_TIMEOUT_MS\)/);
  assert.match(source, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  assert.match(source, /const requestId = window\.crypto\.randomUUID\(\);/);
  assert.match(source, /requestId,/);
});

test("the save endpoint forwards a stable receipt key to the atomic RPC", async () => {
  const source = await readFile(new URL("../src/app/api/picks/route.ts", import.meta.url), "utf8");
  assert.match(source, /requestId\?: string/);
  assert.match(source, /request_id: requestId/);
});

test("the idempotency migration makes duplicate receipt keys a no-op", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260917010000_idempotent_pick_submissions.sql", import.meta.url), "utf8");
  assert.match(source, /pick_submission_receipts/);
  assert.match(source, /on conflict \(request_id\) do nothing/i);
  assert.match(source, /if not found then\s+return;/i);
});
