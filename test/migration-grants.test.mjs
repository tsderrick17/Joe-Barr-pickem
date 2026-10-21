import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// From 2026-10-30 Supabase no longer grants Data API access to new public tables, so a migration that creates a table must grant the server
// role access to it in the same migration. Migrations up to this one are covered by its catch-up grants.
const CUTOFF = "20261021010000";
const directory = new URL("../supabase/migrations/", import.meta.url);

test("the catch-up migration grants the service role everything and keeps future objects usable", async () => {
  const migration = await readFile(new URL(`${CUTOFF}_explicit_service_role_grants.sql`, directory), "utf8");
  for (const statement of [
    /grant all privileges on all tables in schema public to service_role/i,
    /grant all privileges on all sequences in schema public to service_role/i,
    /grant execute on all functions in schema public to service_role/i,
    /alter default privileges for role postgres in schema public\s+grant all privileges on tables to service_role/i,
  ]) assert.match(migration, statement);
});

test("every migration after the catch-up that creates a table also grants the service role access to it", async () => {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql") && name.slice(0, 14) > CUTOFF).sort();
  for (const name of files) {
    const sql = (await readFile(new URL(name, directory), "utf8")).replace(/--[^\n]*/g, "");
    for (const match of sql.matchAll(/create table (?:if not exists )?(?:public\.)?"?([a-z_0-9]+)"?/gi)) {
      const table = match[1];
      const granted = new RegExp(`grant[^;]*(?:public\.)?${table}[^;]*to[^;]*service_role`, "i").test(sql) || /grant all privileges on all tables in schema public to service_role/i.test(sql);
      assert.ok(granted, `${name} creates ${table} without granting it to service_role (add: grant all privileges on public.${table} to service_role;)`);
    }
  }
});
