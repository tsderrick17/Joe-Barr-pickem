import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

const HOUR = 60 * 60 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

test("a Bowl line is preliminary (locked_at empty) until it locks, and only a locked line freezes the matchup", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `prelim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const one = async (sql, values) => (await client.query(sql, values)).rows[0];
    const season = await one("insert into public.bowl_pool_seasons (season_year, player_visible_at) values ($1, $2) returning id", [5000 + Math.floor(Math.random() * 4000), at(-24 * HOUR)]);
    const team = async (name) => (await one("insert into public.bowl_pool_teams (provider_team_id, display_name, short_name) values ($1, $1, 'X') returning id", [`${token}-${name}`])).id;
    const [away, home] = [await team("away"), await team("home")];
    const game = (await one(`
      insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, away_team_id, home_team_id)
      values ($1, $2, 'Test Bowl', $3, $4, 1, $5, $6) returning id
    `, [season.id, `${token}-g`, at(30 * HOUR), at(20 * HOUR), away, home])).id;

    // A preliminary line can be saved: no locked time, and nothing fills one in by default.
    await client.query("insert into public.bowl_pool_game_lines (game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at, locked_at) values ($1, $2, 3.5, 3.5, 'prelim-test', clock_timestamp(), null)", [game, home]);
    assert.equal((await one("select locked_at from public.bowl_pool_game_lines where game_id = $1", [game])).locked_at, null);
    const column = await one("select is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'bowl_pool_game_lines' and column_name = 'locked_at'");
    assert.deepEqual(column, { is_nullable: "YES", column_default: null });

    // While it is preliminary, a provider can move the kickoff and the matchup is not frozen.
    await client.query("update public.bowl_pool_games set kickoff_at = $2 where id = $1", [game, at(31 * HOUR)]);

    // Once locked, the matchup is protected.
    await client.query("update public.bowl_pool_game_lines set locked_at = clock_timestamp() where game_id = $1", [game]);
    await client.query("savepoint frozen");
    await assert.rejects(() => client.query("update public.bowl_pool_games set kickoff_at = $2 where id = $1", [game, at(32 * HOUR)]), /cannot be replaced/);
    await client.query("rollback to savepoint frozen");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
