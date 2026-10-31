import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

const HOUR = 60 * 60 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

test("a Bowl game whose time is not announced can have its kickoff corrected even once its line is locked; a confirmed kickoff and any matchup cannot", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `times-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const one = async (sql, values) => (await client.query(sql, values)).rows[0];
    const season = await one("insert into public.bowl_pool_seasons (season_year, player_visible_at) values ($1, $2) returning id", [5000 + Math.floor(Math.random() * 4000), at(-24 * HOUR)]);
    const team = async (name) => (await one("insert into public.bowl_pool_teams (provider_team_id, display_name, short_name) values ($1, $1, 'X') returning id", [`${token}-${name}`])).id;
    const [away, home, other] = [await team("away"), await team("home"), await team("other")];
    const game = (await one(`
      insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, away_team_id, home_team_id, time_confirmed)
      values ($1, $2, 'Test Bowl', $3, $4, 1, $5, $6, false) returning id
    `, [season.id, `${token}-g`, at(30 * HOUR), at(20 * HOUR), away, home])).id;
    await client.query("insert into public.bowl_pool_game_lines (game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at, locked_at) values ($1, $2, 3.5, 3.5, 'times-test', clock_timestamp(), clock_timestamp())", [game, home]);

    // The kickoff is a placeholder: the real time may replace it although the line is locked. The teams are still frozen.
    await client.query("update public.bowl_pool_games set kickoff_at = $2 where id = $1", [game, at(26 * HOUR)]);
    await client.query("savepoint teams");
    await assert.rejects(() => client.query("update public.bowl_pool_games set home_team_id = $2 where id = $1", [game, other]), /cannot be replaced/);
    await client.query("rollback to savepoint teams");

    // Once ESPN confirms the time, it is as frozen as ever.
    await client.query("update public.bowl_pool_games set kickoff_at = $2, time_confirmed = true where id = $1", [game, at(27 * HOUR)]);
    await client.query("savepoint confirmed");
    await assert.rejects(() => client.query("update public.bowl_pool_games set kickoff_at = $2 where id = $1", [game, at(28 * HOUR)]), /cannot be replaced/);
    await client.query("rollback to savepoint confirmed");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});

test("the 2026 Bowl calendar holds the five games added after September, in kickoff order, with the San Juan Bowl marked Time TBD", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`
      select g.bowl_name, g.kickoff_at, g.order_index, g.time_confirmed, g.line_lock_at
      from public.bowl_pool_games g join public.bowl_pool_seasons s on s.id = g.season_id
      where s.season_year = 2026 order by g.order_index
    `);
    assert.ok(rows.length >= 47, "the 42 seeded games and the five added");
    assert.deepEqual(rows.map((row) => row.order_index), rows.map((_, index) => index + 1));
    assert.ok(rows.every((row, index) => index === 0 || row.kickoff_at >= rows[index - 1].kickoff_at), "in kickoff order");
    for (const name of ["San Juan", "Poinsettia", "Holiday", "Sun", "Arizona"]) assert.ok(rows.some((row) => row.bowl_name === name), name);
    assert.equal(rows.find((row) => row.bowl_name === "San Juan").time_confirmed, false);
    assert.equal(rows.find((row) => row.bowl_name === "Sun").time_confirmed, true);
    assert.equal(new Date(rows.find((row) => row.bowl_name === "Sun").line_lock_at).toISOString(), "2026-12-31T13:00:00.000Z", "8 AM Eastern on game day");
  } finally {
    await client.end();
  }
});
