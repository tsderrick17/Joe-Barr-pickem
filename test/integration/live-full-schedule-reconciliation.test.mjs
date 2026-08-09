import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_FULL_SEASON_DRILL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

test("canonical schedule reconciliation moves safe games and quarantines locked changes", {
  skip: !enabled && "Run the manual isolated workflow with full_season_drill enabled.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `full-reconcile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const season = await client.query("insert into public.seasons(year, state) values ($1, 'regular') returning id", [8000 + Math.floor(Math.random() * 1000)]);
    const teamResult = await client.query("select id from public.teams where active order by abbreviation limit 32");
    assert.equal(teamResult.rows.length, 32, "isolated schema must have all NFL teams");
    const periods = [];
    for (let week = 0; week < 18; week += 1) {
      const start = new Date(Date.UTC(2030, 8, 3 + week * 7, 4));
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const period = await client.query(`
        insert into public.scoring_periods(season_id, display_name, period_type, max_picks, status, display_order, starts_at, ends_at)
        values ($1, $2, 'regular', 3, 'upcoming', $3, $4, $5) returning id
      `, [season.rows[0].id, `Week ${week + 1}`, week + 1, start, end]);
      periods.push({ id: period.rows[0].id, start });
    }
    const payload = [];
    for (let week = 0; week < 18; week += 1) {
      const count = week < 2 ? 16 : 15;
      for (let game = 0; game < count; game += 1) {
        const eventId = `${token}-${week + 1}-${game + 1}`;
        const kickoff = new Date(periods[week].start.getTime() + 5 * 24 * 60 * 60 * 1000 + game * 60_000);
        const lock = new Date(kickoff.getTime() - 6 * 60 * 60 * 1000);
        const row = {
          schedule_source_event_id: eventId, scoring_period_id: periods[week].id,
          away_team_id: teamResult.rows[game % 32].id, home_team_id: teamResult.rows[(31 - game) % 32].id,
          kickoff_at: kickoff.toISOString(), line_lock_at: lock.toISOString(), is_international: false,
        };
        payload.push(row);
        await client.query(`
          insert into public.games(external_game_id, schedule_source, schedule_source_event_id, scoring_period_id,
            away_team_id, home_team_id, kickoff_at, line_lock_at, is_international)
          values ($1, 'nflverse', $2, $3, $4, $5, $6, $7, false)
        `, [`nflverse:${eventId}`, eventId, row.scoring_period_id, row.away_team_id, row.home_team_id, row.kickoff_at, row.line_lock_at]);
      }
    }
    assert.equal(payload.length, 272);
    const safe = payload[0];
    const locked = payload[1];
    safe.kickoff_at = new Date(new Date(safe.kickoff_at).getTime() + 60 * 60 * 1000).toISOString();
    safe.line_lock_at = new Date(new Date(safe.line_lock_at).getTime() + 60 * 60 * 1000).toISOString();
    locked.kickoff_at = new Date(new Date(locked.kickoff_at).getTime() + 2 * 60 * 60 * 1000).toISOString();
    locked.line_lock_at = new Date(new Date(locked.line_lock_at).getTime() + 2 * 60 * 60 * 1000).toISOString();
    await client.query("update public.games set line_lock_at = clock_timestamp() - interval '1 minute' where schedule_source_event_id = $1", [locked.schedule_source_event_id]);

    const result = await client.query("select * from public.reconcile_full_schedule_atomically($1, $2::jsonb)", [season.rows[0].id, JSON.stringify(payload)]);
    assert.deepEqual(result.rows[0], { rescheduled_games: 1, review_games: 1 });
    const saved = await client.query("select schedule_source_event_id, kickoff_at from public.games where schedule_source_event_id in ($1, $2) order by schedule_source_event_id", [safe.schedule_source_event_id, locked.schedule_source_event_id]);
    const safeSaved = saved.rows.find((row) => row.schedule_source_event_id === safe.schedule_source_event_id);
    const lockedSaved = saved.rows.find((row) => row.schedule_source_event_id === locked.schedule_source_event_id);
    assert.equal(safeSaved.kickoff_at.toISOString(), safe.kickoff_at);
    assert.notEqual(lockedSaved.kickoff_at.toISOString(), locked.kickoff_at, "a locked game must await commissioner action");
    const reviews = await client.query("select review_type from public.schedule_change_reviews where game_id = (select id from public.games where schedule_source_event_id = $1)", [locked.schedule_source_event_id]);
    assert.deepEqual(reviews.rows.map((row) => row.review_type), ["timing_after_lock"]);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
