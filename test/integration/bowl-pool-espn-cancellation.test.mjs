import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

// Runs on every isolated workflow run (same gate as the weekly rehearsal).
const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

const HOUR = 60 * 60 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

async function one(client, sql, values = []) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1, sql);
  return result.rows[0];
}

test("isolated Bowl Pool: a game ESPN lists as cancelled is cancelled like the Commissioner's button, and leaves an open note for review", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `espn-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { id: playerId } = await one(client, "insert into public.players(first_name) values ($1) returning id", [`Bowl ${token}`]);
    const season = await one(client, "insert into public.bowl_pool_seasons (season_year, player_visible_at) values ($1, $2) returning id", [5000 + Math.floor(Math.random() * 4000), at(-24 * HOUR)]);
    const teams = [];
    for (let index = 0; index < 2; index += 1) {
      teams.push((await one(client, `
        insert into public.bowl_pool_teams (provider_team_id, display_name, short_name, abbreviation)
        values ($1, $2, $3, $3) returning id
      `, [`${token}-t${index}`, `Cancel Team ${index} ${token}`, `C${index}`])).id);
    }
    const game = await one(client, `
      insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, is_cfp, away_team_id, home_team_id)
      values ($1, $2, 'Snow Bowl', $3, $3, 1, true, $4, $5) returning id
    `, [season.id, `${token}-g`, at(2 * HOUR), teams[0], teams[1]]);
    await client.query("update public.bowl_pool_seasons set championship_game_id = $2 where id = $1", [season.id, game.id]);
    await client.query(`
      insert into public.bowl_pool_game_lines (game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at, locked_at)
      values ($1, $2, 3.5, 3.5, 'espn-cancellation-test', clock_timestamp(), clock_timestamp())
    `, [game.id, teams[1]]);
    await client.query("select public.save_bowl_pool_submission($1, $2, true, $3::jsonb, null)", [playerId, season.id, JSON.stringify([{ game_id: game.id, team_id: teams[0] }])]);

    // The worker's first sighting is only a mark on the game; it changes nothing else.
    await client.query("update public.bowl_pool_games set espn_cancelled_seen_at = clock_timestamp() where id = $1", [game.id]);
    assert.equal((await one(client, "select status from public.bowl_pool_games where id = $1", [game.id])).status, "scheduled");
    assert.equal((await client.query("select 1 from public.bowl_pool_schedule_changes where game_id = $1", [game.id])).rowCount, 0, "marking a game writes no schedule change");

    const cancelled = await one(client, "select * from public.record_bowl_game_cancelled_by_espn($1)", [game.id]);
    assert.equal(cancelled.picks_voided, 1);
    assert.equal((await one(client, "select status from public.bowl_pool_games where id = $1", [game.id])).status, "cancelled");
    assert.equal((await one(client, "select pick.result from public.bowl_pool_picks pick join public.bowl_pool_entries entry on entry.id = pick.entry_id where entry.player_id = $1", [playerId])).result, "void", "the pick is voided, not lost");

    const note = await one(client, "select reason, reviewed_at, old_kickoff_at = new_kickoff_at as same_time from public.bowl_pool_schedule_changes where game_id = $1", [game.id]);
    assert.match(note.reason, /Snow Bowl was cancelled automatically because ESPN lists it as cancelled\. 1 pick was voided\./);
    assert.equal(note.reviewed_at, null, "the note stays open for the Commissioner until reviewed");
    assert.equal(note.same_time, true);

    const audit = await client.query("select actor_player_id from public.audit_logs where entity_id = $1 and action in ('bowl_game_disruption_recorded', 'bowl_game_cancelled_by_espn') order by action", [game.id]);
    assert.deepEqual(audit.rows.map((row) => row.actor_player_id), [null, null], "both records say no person did it");

    await client.query("savepoint again");
    await assert.rejects(client.query("select * from public.record_bowl_game_cancelled_by_espn($1)", [game.id]), /cannot be changed/, "a cancelled game cannot be cancelled twice");
    await client.query("rollback to savepoint again");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
