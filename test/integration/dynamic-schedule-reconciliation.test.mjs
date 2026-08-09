import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_FULL_SEASON_DRILL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

test("isolated schedule reconciliation preserves history and only moves unlocked games", {
  skip: !enabled && "Run the manual isolated workflow with full_season_drill enabled.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `schedule-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const season = await client.query(
      "insert into public.seasons(year, state) values ($1, 'preseason') returning id",
      [7000 + Math.floor(Math.random() * 1000)],
    );
    const period = await client.query(`
      insert into public.scoring_periods
        (season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Schedule Sync', 'regular', 3, 'upcoming', 1) returning id
    `, [season.rows[0].id]);
    const teams = [];
    for (let index = 0; index < 2; index += 1) {
      const team = await client.query(`
        insert into public.teams(abbreviation, city, mascot, full_name)
        values ($1, 'Schedule Sync', $2, $3) returning id
      `, [`${token.slice(-5)}${index}`.toUpperCase(), `Team ${index}`, `Schedule Sync ${index} ${token}`]);
      teams.push(team.rows[0]);
    }
    const kickoff = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const lock = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const game = await client.query(`
      insert into public.games
        (external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at)
      values ($1, $2, $3, $4, $5, $6) returning id
    `, [`${token}-game`, period.rows[0].id, teams[0].id, teams[1].id, kickoff, lock]);
    await client.query(`
      insert into public.game_lines(game_id, favorite_team_id, locked_spread, source, source_captured_at)
      values ($1, $2, 1.5, 'schedule-reconciliation-test', clock_timestamp())
    `, [game.rows[0].id, teams[0].id]);

    const movedKickoff = new Date(kickoff.getTime() + 60 * 60 * 1000).toISOString();
    const movedLock = new Date(lock.getTime() + 60 * 60 * 1000).toISOString();
    const payload = [{
      external_game_id: `${token}-game`, scoring_period_id: period.rows[0].id,
      away_team_id: teams[0].id, home_team_id: teams[1].id,
      kickoff_at: movedKickoff, line_lock_at: movedLock, is_international: false,
    }];
    await client.query(
      "select * from public.import_schedule_atomically($1, $2::jsonb, $3::jsonb, $4::jsonb)",
      [season.rows[0].id, "[]", JSON.stringify(payload), "[]"],
    );
    const saved = await client.query(
      "select scoring_period_id, gameweek_key, kickoff_at, line_lock_at from public.games where id = $1",
      [game.rows[0].id],
    );
    assert.equal(saved.rows[0].kickoff_at.toISOString(), movedKickoff);
    assert.equal(saved.rows[0].line_lock_at.toISOString(), movedLock);
    const released = await client.query("select count(*)::integer as count from public.game_lines where game_id = $1", [game.rows[0].id]);
    assert.equal(released.rows[0].count, 0, "a reschedule must release the obsolete official line");

    const nextPeriod = await client.query(`
      insert into public.scoring_periods
        (season_id, display_name, period_type, max_picks, status, display_order)
      values ($1, 'Schedule Sync Next Week', 'regular', 3, 'upcoming', 2) returning id
    `, [season.rows[0].id]);

    const bootstrapKickoff = new Date(kickoff.getTime() + 7 * 24 * 60 * 60 * 1000);
    const bootstrapLock = new Date(lock.getTime() + 7 * 24 * 60 * 60 * 1000);
    const bootstrap = await client.query(`
      insert into public.games
        (external_game_id, schedule_source, schedule_source_event_id, scoring_period_id,
         away_team_id, home_team_id, kickoff_at, line_lock_at)
      values ($1, 'nflverse', $2, $3, $4, $5, $6, $7) returning id
    `, [`nflverse:${token}-bootstrap`, `${token}-bootstrap`, nextPeriod.rows[0].id,
      teams[1].id, teams[0].id, bootstrapKickoff, bootstrapLock]);
    const oddsIdentity = `${token}-odds-event`;
    await client.query(
      "select * from public.import_schedule_atomically($1, $2::jsonb, $3::jsonb, $4::jsonb)",
      [season.rows[0].id, "[]", JSON.stringify([{
        external_game_id: oddsIdentity, scoring_period_id: nextPeriod.rows[0].id,
        away_team_id: teams[1].id, home_team_id: teams[0].id,
        kickoff_at: bootstrapKickoff.toISOString(), line_lock_at: bootstrapLock.toISOString(),
        is_international: false,
      }]), "[]"],
    );
    const identityHandoff = await client.query(
      "select external_game_id, odds_event_id from public.games where id = $1",
      [bootstrap.rows[0].id],
    );
    assert.equal(identityHandoff.rows[0].external_game_id, `nflverse:${token}-bootstrap`);
    assert.equal(identityHandoff.rows[0].odds_event_id, oddsIdentity);
    const duplicateCount = await client.query(
      "select count(*)::integer count from public.games where scoring_period_id = $1 and away_team_id = $2 and home_team_id = $3",
      [nextPeriod.rows[0].id, teams[1].id, teams[0].id],
    );
    assert.equal(duplicateCount.rows[0].count, 1, "the live odds identity must attach without duplicating the preseason game");

    await client.query("savepoint wrong_gameweek");
    await assert.rejects(
      client.query("update public.games set scoring_period_id = $1 where id = $2", [nextPeriod.rows[0].id, game.rows[0].id]),
      /permanently pinned to its original scoring period/,
    );
    await client.query("rollback to savepoint wrong_gameweek");

    const player = await client.query("insert into public.players(first_name) values ($1) returning id", [`Schedule Sync Player ${token}`]);
    await client.query("savepoint mismatched_pick");
    await assert.rejects(
      client.query(`
        insert into public.picks(player_id, scoring_period_id, game_id, selected_team_id)
        values ($1, $2, $3, $4)
      `, [player.rows[0].id, nextPeriod.rows[0].id, game.rows[0].id, teams[0].id]),
      /scoring period permanently pinned to its game/,
    );
    await client.query("rollback to savepoint mismatched_pick");

    const crossWeekKickoff = new Date(kickoff.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const crossWeekLock = new Date(lock.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
    await client.query(
      "select * from public.reschedule_game_atomically($1, $2, $3, null)",
      [game.rows[0].id, crossWeekKickoff, crossWeekLock],
    );
    const pinnedAfterPostponement = await client.query(
      "select scoring_period_id, gameweek_key, kickoff_at from public.games where id = $1",
      [game.rows[0].id],
    );
    assert.equal(pinnedAfterPostponement.rows[0].scoring_period_id, period.rows[0].id);
    assert.equal(pinnedAfterPostponement.rows[0].gameweek_key.toISOString?.().slice(0, 10) ?? pinnedAfterPostponement.rows[0].gameweek_key, saved.rows[0].gameweek_key.toISOString?.().slice(0, 10) ?? saved.rows[0].gameweek_key);
    assert.equal(pinnedAfterPostponement.rows[0].kickoff_at.toISOString(), crossWeekKickoff);

    await client.query("update public.games set line_lock_at = clock_timestamp() - interval '1 minute' where id = $1", [game.rows[0].id]);
    await assert.rejects(
      client.query(
        "select * from public.import_schedule_atomically($1, $2::jsonb, $3::jsonb, $4::jsonb)",
        [season.rows[0].id, "[]", JSON.stringify([{ ...payload[0], kickoff_at: new Date(kickoff.getTime() + 2 * 60 * 60 * 1000).toISOString() }]), "[]"],
      ),
      /Schedule review required/,
    );
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
