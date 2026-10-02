import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);
const skip = !enabled && "Set PICKEM_TEST_DATABASE_URL for the isolated database to run this test.";

async function one(client, sql, values = []) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1, sql);
  return result.rows[0];
}

/** Fixture state is written with triggers off; the crown function is then run for real. */
async function fixture(client, sql, values = []) {
  await client.query("set local session_replication_role = replica");
  const result = await client.query(sql, values);
  await client.query("set local session_replication_role = origin");
  return result;
}

/**
 * Three players, two regular weeks, one team per pick. Each scenario runs in a
 * transaction that is rolled back, so nothing is left in the isolated database.
 */
async function withSeason(run) {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `cochamp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const season = await one(client, "insert into public.seasons(year, state) values ($1, 'regular_season') returning id, year", [7000 + Math.floor(Math.random() * 900)]);
    const periods = [];
    for (const order of [1, 2]) {
      periods.push(await one(client, `insert into public.scoring_periods (season_id, display_name, period_type, max_picks, status, display_order)
        values ($1, $2, 'regular', 2, $4, $3) returning id`, [season.id, `Week ${order}`, order, order === 1 ? "active" : "upcoming"]));
    }
    const teams = [];
    for (let index = 0; index < 6; index += 1) {
      teams.push(await one(client, "insert into public.teams(abbreviation, city, mascot, full_name) values ($1, 'Co', $2, $3) returning id",
        [`C${index}${token.slice(-2)}`, `Team ${index} ${token}`, `Co Team ${index} ${token}`]));
    }
    const games = [];
    for (const [index, period] of periods.entries()) {
      for (let slot = 0; slot < 3; slot += 1) {
        const kickoff = new Date(Date.now() - (2 - index) * 7 * 86400000 - slot * 3600000).toISOString();
        games.push((await fixture(client, `insert into public.games (external_game_id, odds_event_id, schedule_source, schedule_source_event_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at, gameweek_key)
          values ($1, $1, 'certification', $1, $2, $3, $4, $5, $5, $6) returning id, scoring_period_id, away_team_id, home_team_id`,
          [`${token}-${index}-${slot}`, period.id, teams[slot * 2].id, teams[slot * 2 + 1].id, kickoff, kickoff.slice(0, 10)])).rows[0]);
      }
    }
    const players = [];
    const entries = [];
    for (const name of ["Ann", "Bob", "Cal"]) {
      const player = await one(client, "insert into public.players(first_name) values ($1) returning id", [`${name} ${token}`]);
      players.push(player);
      entries.push(await one(client, "insert into public.survivor_entries(player_id, season_id) values ($1, $2) returning id, player_id", [player.id, season.id]));
    }
    const ctx = {
      client, season, periods, entries, players,
      // A Survivor pick for an entry in a week, with a result.
      pick: (entryIndex, periodIndex, result) => fixture(client, `insert into public.survivor_picks (survivor_entry_id, scoring_period_id, game_id, selected_team_id, result)
        values ($1, $2, $3, $4, $5)`, [entries[entryIndex].id, periods[periodIndex].id, games[periodIndex * 3 + entryIndex].id,
        // Survivor never reuses a team: away side in week 1, home side in week 2.
        periodIndex === 0 ? games[periodIndex * 3 + entryIndex].away_team_id : games[periodIndex * 3 + entryIndex].home_team_id, result]),
      eliminate: (entryIndex, periodIndex) => fixture(client, "update public.survivor_entries set status = 'eliminated', eliminated_scoring_period_id = $2, eliminated_at = clock_timestamp() where id = $1", [entries[entryIndex].id, periods[periodIndex].id]),
      completeWeek: (periodIndex) => fixture(client, "update public.scoring_periods set status = 'complete' where id = $1", [periods[periodIndex].id]),
      crown: async () => (await one(client, "select public.refresh_survivor_champion($1) as champion", [season.id])).champion,
      champions: async () => (await client.query("select player_id from public.pool_championships where season_id = $1 and pool = 'survivor' order by player_id", [season.id])).rows.map((row) => row.player_id),
      sorted: (...indexes) => indexes.map((index) => players[index].id).sort(),
    };
    await run(ctx);
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

test("one survivor wins alone once the deciding week has settled", { skip }, async () => {
  await withSeason(async (s) => {
    // Week 1: Ann and Bob lose; Cal's game has not finished.
    await s.pick(0, 0, "loss"); await s.eliminate(0, 0);
    await s.pick(1, 0, "loss"); await s.eliminate(1, 0);
    await s.pick(2, 0, "pending");
    assert.equal(await s.crown(), null, "Cal could still lose this week, so nobody is crowned yet");
    // Cal wins: Cal is the champion before the week is formally complete.
    await fixture(s.client, "update public.survivor_picks set result = 'win' where survivor_entry_id = $1", [s.entries[2].id]);
    assert.equal(await s.crown(), s.players[2].id);
    assert.deepEqual(await s.champions(), s.sorted(2));
  });
});

test("everyone left eliminated in the same week share the title", { skip }, async () => {
  await withSeason(async (s) => {
    // Week 1: Ann goes out. Week 2: Bob and Cal both lose.
    await s.pick(0, 0, "loss"); await s.eliminate(0, 0);
    await s.pick(1, 0, "win"); await s.pick(2, 0, "win"); await s.completeWeek(0);
    await s.pick(1, 1, "loss"); await s.eliminate(1, 1);
    // Mid-week, with only Cal left and Cal's game still pending, nobody is crowned.
    await s.pick(2, 1, "pending");
    assert.equal(await s.crown(), null);
    await fixture(s.client, "update public.survivor_picks set result = 'loss' where survivor_entry_id = $1 and scoring_period_id = $2", [s.entries[2].id, s.periods[1].id]);
    await s.eliminate(2, 1);
    assert.equal(await s.crown(), null, "waits for the week to settle");
    await s.completeWeek(1);
    await s.crown();
    assert.deepEqual(await s.champions(), s.sorted(1, 2), "Bob and Cal share it; Ann went out a week earlier");
    const marker = await one(s.client, "select survivor_champion_player_id from public.seasons where id = $1", [s.season.id]);
    assert.ok(s.sorted(1, 2).includes(marker.survivor_champion_player_id), "the season is marked as decided");
  });
});

test("several entries that survive the whole regular season share the title", { skip }, async () => {
  await withSeason(async (s) => {
    await s.pick(0, 0, "loss"); await s.eliminate(0, 0);
    await s.pick(1, 0, "win"); await s.pick(2, 0, "win"); await s.completeWeek(0);
    await s.pick(1, 1, "win"); await s.pick(2, 1, "win");
    assert.equal(await s.crown(), null, "the regular season is not over yet");
    await s.completeWeek(1);
    await s.crown();
    assert.deepEqual(await s.champions(), s.sorted(1, 2));
  });
});

test("completing a regular-season week re-checks the champion automatically", { skip }, async () => {
  await withSeason(async (s) => {
    const triggers = await s.client.query("select tgname from pg_trigger where tgname in ('crown_survivor_champion_after_period_complete', 'crown_survivor_champion_after_pick_graded') order by tgname");
    assert.deepEqual(triggers.rows.map((row) => row.tgname), ["crown_survivor_champion_after_period_complete", "crown_survivor_champion_after_pick_graded"]);
    // The one-champion-per-year limit is gone, so co-champions can be recorded.
    const index = await s.client.query("select 1 from pg_indexes where indexname = 'pool_championships_one_survivor_per_year_key'");
    assert.equal(index.rowCount, 0);
  });
});
