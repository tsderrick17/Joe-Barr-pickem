import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_WEEKLY_REHEARSAL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

const hours = (count) => new Date(Date.now() + count * 60 * 60 * 1000).toISOString();
const easternWeekday = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(iso));

/**
 * A season on the morning after a Divisional game day. Before that day: Leader 10 wins, Chaser 9, Trailer 8, Faller 5 and
 * Goner 2, with 6 playoff games left (the day's 2, 2 more Divisional games tomorrow, and the Conference round's 2 picks,
 * not loaded yet), so Goner was already out. On the day Leader won 2, Chaser 1, Trailer 1, Faller and Goner none: 4 games
 * are left, Leader has 12, and Faller (5 + 4 < 12) is knocked out.
 */
async function divisionalMorning(client, token, { lastGameFinal = true } = {}) {
  const one = async (sql, values) => (await client.query(sql, values)).rows[0];
  // Fixture rows are written straight in, past the pick-window and lifecycle guards, inside a transaction that is rolled back.
  await client.query("set local session_replication_role = replica");
  const season = await one("insert into public.seasons(year, state) values ($1, 'playoffs') returning id", [7000 + Math.floor(Math.random() * 900)]);
  const period = (name, type, order, status, maxPicks) => one(
    "insert into public.scoring_periods(season_id, display_name, period_type, display_order, status, max_picks) values ($1, $2, $3, $4, $5, $6) returning id",
    [season.id, name, type, order, status, maxPicks],
  );
  const regular = await period("Week 18", "regular", 18, "complete", 10);
  await period("Wild Card", "playoff", 19, "complete", 6);
  const divisional = await period("Divisional", "playoff", 20, "active", 4);
  await period("Conference", "playoff", 21, "upcoming", 2);
  // Every game has its own two teams: a player picks each team at most once a round.
  let teamIndex = 0;
  const team = async () => (await one("insert into public.teams(abbreviation, city, mascot, full_name) values ($1, 'Race', $2, $3) returning id",
    [`${token}-${teamIndex}`, `Team ${teamIndex} ${token}`, `Race ${teamIndex++} ${token}`])).id;
  const teamOf = new Map();
  let gameIndex = 0;
  const game = async (periodId, kickoff, final) => {
    const away = await team();
    const home = await team();
    const { id } = await one(`
      insert into public.games(external_game_id, scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at, gameweek_key, status, away_score, home_score, finalized_at)
      values ($1, $2, $3, $4, $5, $5, public.nfl_gameweek_key($5), $6, $7, $8, $9) returning id
    `, [`${token}-${gameIndex++}`, periodId, away, home, kickoff, final ? "final" : "scheduled", final ? 24 : null, final ? 17 : null, final ? kickoff : null]);
    teamOf.set(id, away);
    return id;
  };
  const earlier = [];
  for (let index = 0; index < 10; index += 1) earlier.push(await game(regular.id, hours(-72), true));
  const yesterday = [await game(divisional.id, hours(-24), true), await game(divisional.id, hours(-24), lastGameFinal)];
  await game(divisional.id, hours(24), false);
  await game(divisional.id, hours(25), false);

  const player = async (name, commissioner = false) => (await one("insert into public.players(first_name, is_commissioner, active) values ($1, $2, true) returning id", [name, commissioner])).id;
  await player(`Commish ${token}`, true);
  const names = { leader: `Lead${token.slice(-3)}`, chaser: `Chas${token.slice(-3)}`, trailer: `Trai${token.slice(-3)}`, faller: `Fall${token.slice(-3)}`, goner: `Gone${token.slice(-3)}` };
  const record = { leader: [10, 2], chaser: [9, 1], trailer: [8, 1], faller: [5, 0], goner: [2, 0] };
  for (const [key, [before, onTheDay]] of Object.entries(record)) {
    const id = await player(names[key]);
    const pick = (gameId, periodId, result) => client.query(
      "insert into public.picks(player_id, scoring_period_id, game_id, selected_team_id, result) values ($1, $2, $3, $4, $5)",
      [id, periodId, gameId, teamOf.get(gameId), result],
    );
    for (const [index, gameId] of earlier.entries()) await pick(gameId, regular.id, index < before ? "win" : "loss");
    for (const [index, gameId] of yesterday.entries()) await pick(gameId, divisional.id, index === 1 && !lastGameFinal ? "pending" : index < onTheDay ? "win" : "loss");
  }
  await client.query("set local session_replication_role = origin");
  return { divisionalId: divisional.id, names, weekday: easternWeekday(hours(-24)) };
}

const notesFor = async (client, periodId) => (await client.query(
  "select body, is_moderator, announcement_key from public.pool_chat_messages where announcement_key like $1",
  [`playoff-race:${periodId}:%`],
)).rows;

test("the morning after a Divisional game day the moderator posts the playoff race once, with no picks and no magic numbers", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `race${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const { divisionalId, names, weekday } = await divisionalMorning(client, token);

    const first = await client.query("select * from public.post_playoff_race_notes()");
    assert.deepEqual(first.rows.filter((row) => row.note_period_id === divisionalId).map((row) => row.note_outcome), ["posted"]);
    const [note, ...extra] = await notesFor(client, divisionalId);
    assert.equal(extra.length, 0);
    assert.equal(note.is_moderator, true);
    assert.equal(note.body, [
      `🏈 Divisional ${weekday} is in the books. 4 playoff games left.`,
      `${names.leader} leads with 12. Still alive: ${names.chaser} 10 (2 back), ${names.trailer} 9 (3 back).`,
      `Knocked out: ${names.faller}.`,
    ].join("\n"));

    // Every later run that morning finds it posted.
    const again = await client.query("select * from public.post_playoff_race_notes()");
    assert.deepEqual(again.rows.filter((row) => row.note_period_id === divisionalId).map((row) => row.note_outcome), ["already_posted"]);
    assert.equal((await notesFor(client, divisionalId)).length, 1);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});

test("the race note waits while a game from that day is not final, and a player's message keeps its 280-character limit", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const token = `wait${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const { divisionalId } = await divisionalMorning(client, token, { lastGameFinal: false });
    const run = await client.query("select * from public.post_playoff_race_notes()");
    assert.deepEqual(run.rows.filter((row) => row.note_period_id === divisionalId).map((row) => row.note_outcome), ["waiting_for_results"]);
    assert.equal((await notesFor(client, divisionalId)).length, 0);

    const season = (await client.query("select season_id from public.scoring_periods where id = $1", [divisionalId])).rows[0].season_id;
    const author = (await client.query("insert into public.players(first_name) values ($1) returning id", [`Talker ${token}`])).rows[0].id;
    await client.query("savepoint long_message");
    await assert.rejects(
      client.query("insert into public.pool_chat_messages(season_id, player_id, body) values ($1, $2, $3)", [season, author, "x".repeat(281)]),
      (error) => error.code === "23514",
    );
    await client.query("rollback to savepoint long_message");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
