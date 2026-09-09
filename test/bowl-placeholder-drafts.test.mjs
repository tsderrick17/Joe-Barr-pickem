import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, page, migration] = await Promise.all([
  readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260913030000_persist_bowl_placeholder_drafts.sql", import.meta.url), "utf8"),
]);

test("commissioner placeholder Bowl picks persist separately from gradeable team picks", () => {
  assert.match(migration, /add column if not exists preview_selections jsonb/);
  assert.match(route, /player\.is_commissioner && !game\.away_team_id && !game\.home_team_id/);
  assert.match(route, /update\(\{ preview_selections: previewSelections \}\)/);
  assert.match(route, /ownPreviewSelections:/);
  assert.match(page, /payload\.ownPreviewSelections/);
  assert.match(page, /teamId:.*side/s);
});
