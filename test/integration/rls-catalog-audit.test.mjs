import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_RLS_AUDIT === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

const sensitiveTables = [
  "players",
  "picks",
  "survivor_entries",
  "survivor_picks",
  "audit_logs",
  "email_reminder_deliveries",
  "push_subscriptions",
  "push_reminders",
  "push_reminder_deliveries",
  "playoff_day_eligibility",
  "score_check_backoff",
];

const privilegedFunctions = [
  "finalize_games_atomically",
  "claim_automation_execution_lease",
  "release_automation_execution_lease",
  "save_slate_selections",
  "void_disrupted_picks",
  "record_game_disruption",
  "ensure_annual_season_rollover",
  "correct_final_game_score_atomically",
  "snapshot_playoff_day_eligibility",
];

test("isolated database protects personal records and privileged functions with RLS and grants", {
  skip: !enabled && "Run the isolated workflow to audit database access controls.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  try {
    const schemaUsage = await client.query(`
      select role_name,
        has_schema_privilege(role_name, 'public', 'usage') as can_use_public
      from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    `);
    assert.equal(schemaUsage.rowCount, 3);
    for (const role of schemaUsage.rows) {
      assert.equal(
        role.can_use_public,
        true,
        `${role.role_name} must retain USAGE on the exposed public schema`,
      );
    }

    const serverTables = await client.query(`
      select c.relname,
        has_table_privilege('service_role', c.oid, 'select, insert, update, delete') as server_can_manage
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    `);
    assert.ok(serverTables.rowCount > 0, "the public schema must contain application tables");
    for (const table of serverTables.rows) {
      assert.equal(
        table.server_can_manage,
        true,
        `service_role must retain server DML access on public.${table.relname}`,
      );
    }

    const tables = await client.query(`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1::text[])
    `, [sensitiveTables]);
    assert.equal(tables.rowCount, sensitiveTables.length, "every sensitive table must exist in the audit");
    for (const table of tables.rows) {
      assert.equal(table.relrowsecurity, true, `RLS must be enabled on public.${table.relname}`);
    }

    const functions = await client.query(`
      select p.proname,
        has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
        has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
        has_function_privilege('service_role', p.oid, 'execute') as service_can_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])
    `, [privilegedFunctions]);
    assert.ok(functions.rowCount >= privilegedFunctions.length, "every privileged function must exist in the audit");
    for (const fn of functions.rows) {
      assert.equal(fn.anon_can_execute, false, `anon must not execute ${fn.proname}`);
      assert.equal(fn.authenticated_can_execute, false, `authenticated must not execute ${fn.proname}`);
      assert.equal(fn.service_can_execute, true, `service_role must execute ${fn.proname}`);
    }
  } finally {
    await client.end();
  }
});
