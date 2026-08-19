import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260818021000_harden_function_search_paths.sql", import.meta.url);

test("security hardening pins mutable public function paths without disturbing explicit paths", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /procedure\.proconfig/);
  assert.match(migration, /alter function %s set search_path = public/i);
  assert.match(migration, /where config\.setting like 'search_path=%'/i);
});

test("the untracked RLS helper is never executable by public callers", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /to_regprocedure\('public\.rls_auto_enable\(\)'\)/);
  assert.match(migration, /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.rls_auto_enable\(\) to service_role/i);
});
