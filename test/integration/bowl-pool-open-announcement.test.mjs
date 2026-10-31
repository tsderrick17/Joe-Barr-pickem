import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

test("the Bowl Pool opening announcement is a reminder kind the database accepts, and its key lets it be queued only once", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `open-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sender = (await client.query("insert into public.players(first_name, is_commissioner) values ($1, true) returning id", [`Opening ${token}`])).rows[0].id;
    const queue = () => client.query(`
      insert into public.push_reminders (created_by_player_id, category, audience, title, body, scheduled_for, source_game_ids, recap_snapshot, automation_key)
      values ($1, 'bowl_pool_open', 'all_active', 'The Bowl Pool is open', 'Claim your seat and pick every bowl and playoff game against the spread. First game: Tue, Dec 15.', now(), '{}', '{"kind":"bowl_pool_open","intro":"x","steps":["y"]}', $2)
    `, [sender, `bowl:${token}:open`]);
    await queue();
    await client.query("savepoint again");
    await assert.rejects(queue, (error) => error.code === "23505", "the same announcement cannot be queued twice");
    await client.query("rollback to savepoint again");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
