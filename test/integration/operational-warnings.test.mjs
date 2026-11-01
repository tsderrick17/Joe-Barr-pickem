import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

// Runs on every isolated workflow run (same gate as the weekly rehearsal).
const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

async function one(client, sql, values = []) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1, sql);
  return result.rows[0];
}

test("isolated operational warnings: one row per job and wording that counts repeats, says when to tell Sentry, and forgets old ones", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const job = `bowl_scores-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = async (message, details) => (await one(client, "select public.record_operational_warning($1, $2, $3::jsonb) as report", [job, message, JSON.stringify(details)])).report;
    const row = (message) => one(client, "select occurrences, details, first_seen_at, last_seen_at from public.operational_warnings where job = $1 and message = $2", [job, message]);

    assert.equal(await record("A game could not be updated.", { gameId: "g1" }), true, "the first sighting is reported");
    assert.equal(await record("A game could not be updated.", { gameId: "g2" }), false, "the next one, moments later, is not");
    const repeated = await row("A game could not be updated.");
    assert.equal(repeated.occurrences, 2);
    assert.deepEqual(repeated.details, { gameId: "g2" }, "the latest details are kept");
    assert.equal(await record("Another wording.", {}), true, "a different wording is its own warning");
    assert.equal((await client.query("select 1 from public.operational_warnings where job = $1", [job])).rowCount, 2);

    // Quiet for 11 hours: still known. Quiet for 13: reported again.
    await client.query("update public.operational_warnings set last_seen_at = now() - interval '11 hours' where job = $1 and message = 'A game could not be updated.'", [job]);
    assert.equal(await record("A game could not be updated.", {}), false);
    await client.query("update public.operational_warnings set last_seen_at = now() - interval '13 hours' where job = $1 and message = 'A game could not be updated.'", [job]);
    assert.equal(await record("A game could not be updated.", {}), true, "it came back after 12 quiet hours");
    assert.equal((await row("A game could not be updated.")).occurrences, 4);

    // Not seen for 31 days: dropped the next time any warning is recorded.
    await client.query("update public.operational_warnings set last_seen_at = now() - interval '31 days' where job = $1 and message = 'Another wording.'", [job]);
    await record("A third wording.", {});
    assert.equal((await client.query("select 1 from public.operational_warnings where job = $1 and message = 'Another wording.'", [job])).rowCount, 0, "a warning gone for a month is forgotten");

    const grants = await one(client, `
      select has_table_privilege('anon', 'public.operational_warnings', 'select') as anon_read,
             has_table_privilege('authenticated', 'public.operational_warnings', 'select') as player_read,
             has_function_privilege('anon', 'public.record_operational_warning(text, text, jsonb)', 'execute') as anon_run,
             has_function_privilege('authenticated', 'public.record_operational_warning(text, text, jsonb)', 'execute') as player_run
    `);
    assert.deepEqual(grants, { anon_read: false, player_read: false, anon_run: false, player_run: false }, "only the server can read or write warnings");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
