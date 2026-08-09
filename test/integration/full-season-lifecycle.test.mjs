import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_FULL_SEASON_DRILL === "true"
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

test("isolated full season preserves scoring, day-start playoff eligibility, history, privacy, and rollover", {
  skip: !enabled && "Run the manual isolated workflow with full_season_drill enabled.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seasonYear = 6000 + Math.floor(Math.random() * 1000);
    const leader = await insertOne(client,
      "insert into public.players(first_name) values ($1) returning id",
      [`Lifecycle Leader ${token}`],
    );
    const chaser = await insertOne(client,
      "insert into public.players(first_name) values ($1) returning id",
      [`Lifecycle Chaser ${token}`],
    );
    const season = await insertOne(client,
      "insert into public.seasons(year, state) values ($1, 'preseason') returning id",
      [seasonYear],
    );
    const regular = await insertOne(client, `
      insert into public.scoring_periods
        (season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Lifecycle Regular Season', 'regular', 3, 'active', 1)
      returning id
    `, [season.id]);
    const playoff = await insertOne(client, `
      insert into public.scoring_periods
        (season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Lifecycle Playoff Weekend', 'playoff', 3, 'upcoming', 2)
      returning id
    `, [season.id]);

    const startedSeason = await insertOne(client,
      "select state from public.seasons where id = $1",
      [season.id],
    );
    assert.equal(startedSeason.state, "regular_season");

    const teams = [];
    for (let index = 0; index < 12; index += 1) {
      teams.push(await insertOne(client, `
        insert into public.teams(abbreviation, city, mascot, full_name)
        values ($1, 'Lifecycle', $2, $3)
        returning id
      `, [
        `${token.slice(-4)}${index.toString(36)}`.toUpperCase(),
        `Team ${index + 1} ${token}`,
        `Lifecycle Team ${index + 1} ${token}`,
      ]));
    }

    const games = [];
    for (let index = 0; index < 6; index += 1) {
      const periodId = index < 3 ? regular.id : playoff.id;
      const game = await insertOne(client, `
        insert into public.games
          (external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at)
        values ($1, $2, $3, $4, $5, $6)
        returning id, scoring_period_id, away_team_id, home_team_id
      `, [
        `${token}-game-${index + 1}`,
        periodId,
        teams[index * 2].id,
        teams[index * 2 + 1].id,
        iso(48 * 60 * 60 * 1000),
        iso(47 * 60 * 60 * 1000),
      ]);
      games.push(game);
      await client.query(`
        insert into public.game_lines
          (game_id, favorite_team_id, locked_spread, source, source_captured_at)
        values ($1, $2, 0.5, 'full-season-lifecycle-drill', clock_timestamp())
      `, [game.id, game.away_team_id]);
      await client.query(`
        insert into public.picks(player_id, scoring_period_id, game_id, selected_team_id)
        values ($1, $2, $3, $4), ($5, $2, $3, $6)
      `, [leader.id, periodId, game.id, game.away_team_id, chaser.id, game.home_team_id]);
    }

    const regularGames = games.slice(0, 3);
    const playoffGames = games.slice(3);
    await client.query(`
      update public.games
      set kickoff_at = $1, line_lock_at = $2
      where id = any($3::uuid[])
    `, [iso(-72 * 60 * 60 * 1000), iso(-73 * 60 * 60 * 1000), regularGames.map((game) => game.id)]);

    const regularFinal = await insertOne(client,
      "select * from public.finalize_games_atomically($1::jsonb, $2::timestamptz)",
      [JSON.stringify(regularGames.map((game) => ({ game_id: game.id, away_score: 24, home_score: 17 }))), new Date().toISOString()],
    );
    assert.deepEqual(regularFinal, {
      final_scores_imported: 3,
      ats_picks_graded: 6,
      survivor_picks_graded: 0,
    });

    await client.query(`
      update public.games
      set kickoff_at = $1, line_lock_at = $2
      where id = any($3::uuid[])
    `, [iso(-24 * 60 * 60 * 1000), iso(-25 * 60 * 60 * 1000), playoffGames.slice(0, 2).map((game) => game.id)]);
    await client.query(`
      update public.games set kickoff_at = $1, line_lock_at = $2 where id = $3
    `, [iso(24 * 60 * 60 * 1000), iso(23 * 60 * 60 * 1000), playoffGames[2].id]);

    await client.query(
      "select * from public.complete_scoring_period_atomically($1, $2, $3)",
      [regular.id, playoff.id, new Date().toISOString()],
    );
    const playoffSeason = await insertOne(client, "select state from public.seasons where id = $1", [season.id]);
    assert.equal(playoffSeason.state, "playoffs");

    await client.query(
      "select * from public.snapshot_playoff_day_eligibility($1, $2)",
      [playoff.id, iso(-36 * 60 * 60 * 1000)],
    );
    const firstEligibility = await client.query(`
      select player_id, is_eligible
      from public.playoff_day_eligibility
      where scoring_period_id = $1 and player_id = any($2::uuid[])
    `, [playoff.id, [leader.id, chaser.id]]);
    assert.equal(firstEligibility.rowCount, 2);
    assert.ok(firstEligibility.rows.every((row) => row.is_eligible));

    const dayOneFinal = await insertOne(client,
      "select * from public.finalize_games_atomically($1::jsonb, $2::timestamptz)",
      [JSON.stringify(playoffGames.slice(0, 2).map((game) => ({ game_id: game.id, away_score: 27, home_score: 10 }))), new Date().toISOString()],
    );
    assert.equal(dayOneFinal.ats_picks_graded, 4);
    const chaserDayOne = await client.query(`
      select result from public.picks
      where player_id = $1 and game_id = any($2::uuid[])
      order by game_id
    `, [chaser.id, playoffGames.slice(0, 2).map((game) => game.id)]);
    assert.deepEqual(chaserDayOne.rows.map((row) => row.result), ["loss", "loss"]);

    await client.query(
      "select * from public.snapshot_playoff_day_eligibility($1, $2)",
      [playoff.id, new Date().toISOString()],
    );
    const latestEligibility = await client.query(`
      select distinct on (player_id) player_id, is_eligible
      from public.playoff_day_eligibility
      where scoring_period_id = $1 and player_id = any($2::uuid[])
      order by player_id, game_day desc
    `, [playoff.id, [leader.id, chaser.id]]);
    const latestByPlayer = new Map(latestEligibility.rows.map((row) => [row.player_id, row.is_eligible]));
    assert.equal(latestByPlayer.get(leader.id), true);
    assert.equal(latestByPlayer.get(chaser.id), false);

    const chaserVoided = await insertOne(client,
      "select result from public.picks where player_id = $1 and game_id = $2",
      [chaser.id, playoffGames[2].id],
    );
    assert.equal(chaserVoided.result, "void");

    const privacy = await insertOne(client, `
      select
        has_table_privilege('anon', 'public.picks', 'select') as anon_can_read_picks,
        has_table_privilege('authenticated', 'public.playoff_day_eligibility', 'select') as members_can_read_private_eligibility,
        has_function_privilege('anon', 'public.finalize_games_atomically(jsonb,timestamptz)', 'execute') as anon_can_finalize
    `);
    assert.deepEqual(privacy, {
      anon_can_read_picks: false,
      members_can_read_private_eligibility: false,
      anon_can_finalize: false,
    });

    await client.query(
      "update public.games set kickoff_at = $1, line_lock_at = $2 where id = $3",
      [iso(-60 * 1000), iso(-2 * 60 * 1000), playoffGames[2].id],
    );
    await client.query(
      "select * from public.finalize_games_atomically($1::jsonb, $2::timestamptz)",
      [JSON.stringify([{ game_id: playoffGames[2].id, away_score: 20, home_score: 13 }]), new Date().toISOString()],
    );
    await client.query(
      "select * from public.complete_scoring_period_atomically($1, null, $2)",
      [playoff.id, new Date().toISOString()],
    );

    const closedSeason = await insertOne(client, "select state from public.seasons where id = $1", [season.id]);
    assert.equal(closedSeason.state, "complete");
    const championship = await insertOne(client, `
      select season_year, pool, player_id
      from public.pool_championships
      where season_year = $1 and pool = 'pickem'
    `, [seasonYear]);
    assert.deepEqual(championship, { season_year: seasonYear, pool: "pickem", player_id: leader.id });

    const rollover = await insertOne(client,
      "select * from public.ensure_annual_season_rollover($1::timestamptz)",
      [`${seasonYear + 1}-08-01T12:00:00.000Z`],
    );
    assert.equal(rollover.created, true);
    assert.equal(rollover.season_year, seasonYear + 1);

    const rolloverRetry = await insertOne(client,
      "select * from public.ensure_annual_season_rollover($1::timestamptz)",
      [`${seasonYear + 1}-08-01T12:00:00.000Z`],
    );
    assert.deepEqual(rolloverRetry, {
      season_id: rollover.season_id,
      season_year: seasonYear + 1,
      created: false,
    });

    const nextPeriods = await client.query(`
      select status, starts_at, ends_at
      from public.scoring_periods
      where season_id = $1
      order by display_order
    `, [rollover.season_id]);
    assert.equal(nextPeriods.rowCount, 2);
    assert.ok(nextPeriods.rows.every((period) => period.status === "upcoming" && period.starts_at === null && period.ends_at === null));

    const oldRecords = await insertOne(client, `
      select count(*)::integer as count
      from public.picks where player_id = any($1::uuid[])
    `, [[leader.id, chaser.id]]);
    assert.equal(oldRecords.count, 12);
    const copiedRecords = await insertOne(client, `
      select count(*)::integer as count
      from public.picks pick
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where period.season_id = $1
    `, [rollover.season_id]);
    assert.equal(copiedRecords.count, 0);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
