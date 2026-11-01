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

// Moves a fixture game's clock without the live-pool triggers that forbid editing a game after it started.
async function backdated(client, sql, values) {
  await client.query("set local session_replication_role = replica");
  try {
    return await client.query(sql, values);
  } finally {
    await client.query("set local session_replication_role = origin");
  }
}

async function refuses(client, pattern, sql, values) {
  await client.query("savepoint refusal");
  await assert.rejects(client.query(sql, values), pattern);
  await client.query("rollback to savepoint refusal");
}

test("isolated last-resort final: graded through the normal path, audited, and refused unless the provider's window has passed", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `verified-final-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const season = await one(client, "insert into public.seasons(year, state) values ($1, 'regular_season') returning id", [8000 + Math.floor(Math.random() * 900)]);
    const period = await one(client, `
      insert into public.scoring_periods(season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Verified final week', 'regular', 3, 'active', 1) returning id
    `, [season.id]);
    const teams = [];
    for (let index = 0; index < 2; index += 1) {
      teams.push(await one(client, "insert into public.teams(abbreviation, city, mascot, full_name) values ($1, 'Verified', $2, $3) returning id", [`${token.slice(-4)}${index}`.toUpperCase(), `Team ${index}`, `Verified ${index} ${token}`]));
    }
    const commissioner = await one(client, "insert into public.players(first_name, is_commissioner) values ($1, true) returning id", [`Verified ${token}`]);

    const addGame = async (name, kickoffInterval) => {
      const game = await one(client, `
        insert into public.games(external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at)
        values ($1, $2, $3, $4, now() + interval '2 days', now() + interval '1 day') returning id
      `, [`${token}-${name}`, period.id, teams[0].id, teams[1].id]);
      await client.query("insert into public.game_lines(game_id, favorite_team_id, locked_spread, source, source_captured_at) values ($1, $2, 3.5, 'verified-final-test', clock_timestamp())", [game.id, teams[0].id]);
      await backdated(client, "update public.games set kickoff_at = now() - $2::interval, line_lock_at = now() - $2::interval - interval '1 hour' where id = $1", [game.id, kickoffInterval]);
      return game.id;
    };

    const tooRecent = await addGame("recent", "2 days");
    await refuses(client, /three-day window/, "select * from public.record_verified_final($1, 24, 17, 'NFL.com', $2)", [tooRecent, commissioner.id]);

    const overdue = await addGame("overdue", "4 days");
    await backdated(client, "insert into public.picks(player_id, scoring_period_id, game_id, selected_team_id) values ($1, $2, $3, $4)", [commissioner.id, period.id, overdue, teams[0].id]);
    await client.query("insert into public.score_check_backoff(game_id, attempts) values ($1, 12)", [overdue]);

    await refuses(client, /Say where the final score was verified/, "select * from public.record_verified_final($1, 24, 17, '   ', $2)", [overdue, commissioner.id]);
    await refuses(client, /cannot be negative/, "select * from public.record_verified_final($1, -1, 17, 'NFL.com', $2)", [overdue, commissioner.id]);
    await refuses(client, /not found/, "select * from public.record_verified_final(gen_random_uuid(), 24, 17, 'NFL.com', $1)", [commissioner.id]);
    assert.equal((await one(client, "select status from public.games where id = $1", [overdue])).status, "scheduled", "every refusal left the game alone");

    const saved = await one(client, "select * from public.record_verified_final($1, 24, 17, '  NFL.com box score  ', $2)", [overdue, commissioner.id]);
    assert.deepEqual(saved, { final_scores_imported: 1, ats_picks_graded: 1, survivor_picks_graded: 0 });
    const game = await one(client, "select status, away_score, home_score, finalized_at from public.games where id = $1", [overdue]);
    assert.equal(game.status, "final");
    assert.deepEqual([game.away_score, game.home_score], [24, 17]);
    assert.ok(game.finalized_at, "the final is stamped like an automatic one");
    assert.equal((await one(client, "select result from public.picks where game_id = $1", [overdue])).result, "win", "the favorite won by 7 and covered 3.5");
    assert.equal((await client.query("select 1 from public.score_check_backoff where game_id = $1", [overdue])).rowCount, 0, "the retry ladder no longer waits on this game");

    const audit = await one(client, "select actor_player_id, details from public.audit_logs where action = 'final_score_entered_manually' and entity_id = $1", [overdue]);
    assert.equal(audit.actor_player_id, commissioner.id);
    const { kickoff_at: auditedKickoff, ...auditedFacts } = audit.details;
    assert.ok(auditedKickoff, "the audit row keeps the kickoff it was entered for");
    assert.deepEqual(auditedFacts, { away_score: 24, home_score: 17, verified_by: "NFL.com box score", ats_graded: 1, survivor_graded: 0 });

    await refuses(client, /already has a final score/, "select * from public.record_verified_final($1, 20, 17, 'NFL.com', $2)", [overdue, commissioner.id]);

    const cancelled = await addGame("cancelled", "5 days");
    await backdated(client, "update public.games set status = 'cancelled' where id = $1", [cancelled]);
    await refuses(client, /no final score to enter/, "select * from public.record_verified_final($1, 24, 17, 'NFL.com', $2)", [cancelled, commissioner.id]);

    const grants = await one(client, `
      select has_function_privilege('anon', 'public.record_verified_final(uuid, integer, integer, text, uuid)', 'execute') as anon_run,
             has_function_privilege('authenticated', 'public.record_verified_final(uuid, integer, integer, text, uuid)', 'execute') as player_run,
             has_function_privilege('service_role', 'public.record_verified_final(uuid, integer, integer, text, uuid)', 'execute') as server_run
    `);
    assert.deepEqual(grants, { anon_run: false, player_run: false, server_run: true }, "only the server can enter a final");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
