import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

function iso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function insertOne(client, sql, values = []) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

test("weekly isolated rehearsal revises picks, grades a slate, and hands off to the next week", {
  skip: !enabled && "Run the scheduled isolated workflow with the weekly rehearsal enabled.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `weekly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seasonYear = 8000 + Math.floor(Math.random() * 1000);
    const playerA = await insertOne(client,
      "insert into public.players(first_name) values ($1) returning id",
      [`Weekly A ${token}`],
    );
    const playerB = await insertOne(client,
      "insert into public.players(first_name) values ($1) returning id",
      [`Weekly B ${token}`],
    );
    const season = await insertOne(client,
      "insert into public.seasons(year, state) values ($1, 'preseason') returning id",
      [seasonYear],
    );
    const weekOne = await insertOne(client, `
      insert into public.scoring_periods
        (season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Weekly Rehearsal Week 1', 'regular', 2, 'active', 1)
      returning id
    `, [season.id]);
    const weekTwo = await insertOne(client, `
      insert into public.scoring_periods
        (season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Weekly Rehearsal Week 2', 'regular', 2, 'upcoming', 2)
      returning id
    `, [season.id]);

    const teams = [];
    for (let index = 0; index < 8; index += 1) {
      teams.push(await insertOne(client, `
        insert into public.teams(abbreviation, city, mascot, full_name)
        values ($1, 'Weekly', $2, $3)
        returning id
      `, [
        `${token.slice(-3)}${index.toString(36)}`.toUpperCase(),
        `Team ${index + 1} ${token}`,
        `Weekly Team ${index + 1} ${token}`,
      ]));
    }

    const games = [];
    for (let index = 0; index < 4; index += 1) {
      const periodId = index < 3 ? weekOne.id : weekTwo.id;
      const game = await insertOne(client, `
        insert into public.games
          (external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at)
        values ($1, $2, $3, $4, $5, $6)
        returning id, away_team_id, home_team_id
      `, [
        `${token}-game-${index + 1}`,
        periodId,
        teams[index * 2].id,
        teams[index * 2 + 1].id,
        iso(48 * 60 * 60 * 1000),
        iso(47 * 60 * 60 * 1000),
      ]);
      games.push(game);
      if (index < 3) {
        await client.query(`
          insert into public.game_lines
            (game_id, favorite_team_id, locked_spread, source, source_captured_at)
          values ($1, $2, 0.5, 'weekly-isolated-rehearsal', clock_timestamp())
        `, [game.id, game.away_team_id]);
      }
    }

    const entryA = await insertOne(client,
      "insert into public.survivor_entries(player_id, season_id) values ($1, $2) returning id",
      [playerA.id, season.id],
    );
    const entryB = await insertOne(client,
      "insert into public.survivor_entries(player_id, season_id) values ($1, $2) returning id",
      [playerB.id, season.id],
    );

    const ats = (pairs) => JSON.stringify(pairs.map(([game, teamId]) => ({ game_id: game.id, selected_team_id: teamId })));
    const survivor = (game, teamId) => JSON.stringify({ game_id: game.id, selected_team_id: teamId });

    await client.query("select public.replace_unlocked_picks($1, $2, $3::jsonb)", [
      playerA.id, weekOne.id, ats([[games[0], games[0].away_team_id], [games[1], games[1].away_team_id]]),
    ]);
    await client.query("select public.replace_unlocked_survivor_pick($1, $2, $3::jsonb)", [
      entryA.id, weekOne.id, survivor(games[0], games[0].away_team_id),
    ]);

    // Rehearse the common player flow: revise both pools before kickoff.
    await client.query("select public.replace_unlocked_picks($1, $2, $3::jsonb)", [
      playerA.id, weekOne.id, ats([[games[1], games[1].away_team_id], [games[2], games[2].away_team_id]]),
    ]);
    await client.query("select public.replace_unlocked_survivor_pick($1, $2, $3::jsonb)", [
      entryA.id, weekOne.id, survivor(games[1], games[1].away_team_id),
    ]);
    await client.query("select public.replace_unlocked_picks($1, $2, $3::jsonb)", [
      playerB.id, weekOne.id, ats([[games[0], games[0].home_team_id], [games[1], games[1].home_team_id]]),
    ]);
    await client.query("select public.replace_unlocked_survivor_pick($1, $2, $3::jsonb)", [
      entryB.id, weekOne.id, survivor(games[0], games[0].home_team_id),
    ]);

    const revisedAts = await client.query(`
      select game_id, selected_team_id
      from public.picks
      where player_id = $1 and scoring_period_id = $2 and result <> 'void'
      order by game_id
    `, [playerA.id, weekOne.id]);
    assert.equal(revisedAts.rowCount, 2);
    assert.deepEqual(
      new Set(revisedAts.rows.map((pick) => pick.game_id)),
      new Set([games[1].id, games[2].id]),
      "the final saved ticket must replace the earlier draft",
    );
    const revisedSurvivor = await insertOne(client, `
      select game_id, selected_team_id
      from public.survivor_picks
      where survivor_entry_id = $1 and scoring_period_id = $2 and result <> 'void'
    `, [entryA.id, weekOne.id]);
    assert.equal(revisedSurvivor.game_id, games[1].id);

    await client.query(`
      update public.games
      set kickoff_at = $1, line_lock_at = $2
      where id = any($3::uuid[])
    `, [iso(-2 * 60 * 60 * 1000), iso(-3 * 60 * 60 * 1000), games.slice(0, 3).map((game) => game.id)]);
    const finalized = await insertOne(client,
      "select * from public.finalize_games_atomically($1::jsonb, $2::timestamptz)",
      [JSON.stringify(games.slice(0, 3).map((game) => ({ game_id: game.id, away_score: 24, home_score: 17 }))), new Date().toISOString()],
    );
    assert.deepEqual(finalized, {
      final_scores_imported: 3,
      ats_picks_graded: 4,
      survivor_picks_graded: 2,
    });

    const playerAResults = await client.query(`
      select result from public.picks
      where player_id = $1 and scoring_period_id = $2
      order by game_id
    `, [playerA.id, weekOne.id]);
    assert.deepEqual(playerAResults.rows.map((pick) => pick.result), ["win", "win"]);
    const survivorResults = await client.query(`
      select entry.player_id, pick.result
      from public.survivor_picks pick
      join public.survivor_entries entry on entry.id = pick.survivor_entry_id
      where pick.scoring_period_id = $1
      order by entry.player_id
    `, [weekOne.id]);
    assert.deepEqual(new Set(survivorResults.rows.map((pick) => pick.result)), new Set(["win", "loss"]));

    const handoff = await insertOne(client,
      "select * from public.complete_scoring_period_atomically($1, $2, $3)",
      [weekOne.id, weekTwo.id, new Date().toISOString()],
    );
    assert.deepEqual(handoff, { completed_period_id: weekOne.id, activated_period_id: weekTwo.id });

    const periods = await client.query(`
      select id, status from public.scoring_periods
      where season_id = $1 order by display_order
    `, [season.id]);
    assert.deepEqual(periods.rows, [
      { id: weekOne.id, status: "complete" },
      { id: weekTwo.id, status: "active" },
    ]);
    const activeCount = await insertOne(client, `
      select count(*)::integer as count
      from public.scoring_periods where season_id = $1 and status = 'active'
    `, [season.id]);
    assert.equal(activeCount.count, 1);
    const preservedHistory = await insertOne(client, `
      select
        (select count(*) from public.picks where scoring_period_id = $1)::integer as picks,
        (select count(*) from public.survivor_picks where scoring_period_id = $1)::integer as survivor_picks,
        (select count(*) from public.audit_logs where action = 'scoring_period_completed' and entity_id = $1)::integer as completions
    `, [weekOne.id]);
    assert.deepEqual(preservedHistory, { picks: 4, survivor_picks: 2, completions: 1 });
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
