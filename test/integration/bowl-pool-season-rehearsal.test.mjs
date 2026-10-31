import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

// A rehearsal of the Bowl season's middle: players coming back day after day while games kick off one by one, a postponement, a
// cancellation, and the reminders that count down to each game. The whole-season basics (entries, locks, grading, disruptions,
// receipts, champion, tiebreaker) are in bowl-pool-lifecycle.test.mjs; the window's opening and closing are in season-phase.test.mjs.
// Everything runs inside one rolled-back transaction on the isolated database.
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

async function refuses(client, label, sql, values, pattern) {
  await client.query(`savepoint ${label}`);
  try {
    await client.query(sql, values);
    assert.fail(`${label}: expected the database to refuse this`);
  } catch (error) {
    if (error.code === "ERR_ASSERTION") throw error;
    assert.match(error.message, pattern, `${label}: ${error.message}`);
  } finally {
    await client.query(`rollback to savepoint ${label}`);
  }
}

// A game kicks off: its kickoff moves into the past without firing the freeze, as a clock moving forward would.
async function kickOff(client, gameId) {
  await client.query("set local session_replication_role = replica");
  await client.query("update public.bowl_pool_games set kickoff_at = $2, line_lock_at = $2, status = 'live' where id = $1", [gameId, at(-HOUR)]);
  await client.query("update public.bowl_pool_seasons set first_kickoff_at = (select min(kickoff_at) from public.bowl_pool_games where season_id = bowl_pool_seasons.id) where id = (select season_id from public.bowl_pool_games where id = $1)", [gameId]);
  await client.query("set local session_replication_role = origin");
}

// Four games a day or two apart, each with its two teams and a locked line (the home team favored by 3.5).
async function startSeason(client) {
  const token = `rehearsal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const player = async (name, commissioner = false) => (await one(client,
    "insert into public.players(first_name, is_commissioner) values ($1, $2) returning id", [`${name} ${token}`, commissioner])).id;
  const [A, B, commissioner] = [await player("Rehearsal A"), await player("Rehearsal B"), await player("Rehearsal Commissioner", true)];
  const season = await one(client, "insert into public.bowl_pool_seasons (season_year, player_visible_at) values ($1, $2) returning id",
    [5000 + Math.floor(Math.random() * 4000), at(-24 * HOUR)]);
  const games = [];
  const sides = [];
  for (const [index, hours] of [2, 30, 54, 78].entries()) {
    const away = (await one(client, "insert into public.bowl_pool_teams (provider_team_id, display_name, short_name) values ($1, $1, 'A') returning id", [`${token}-a${index}`])).id;
    const home = (await one(client, "insert into public.bowl_pool_teams (provider_team_id, display_name, short_name) values ($1, $1, 'H') returning id", [`${token}-h${index}`])).id;
    const game = (await one(client, `
      insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, away_team_id, home_team_id)
      values ($1, $2, $3, $4, $4, $5, $6, $7) returning id
    `, [season.id, `${token}-g${index}`, `Rehearsal Bowl ${index + 1}`, at(hours * HOUR), index + 1, away, home])).id;
    await client.query("insert into public.bowl_pool_game_lines (game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at, locked_at) values ($1, $2, 3.5, 3.5, 'rehearsal', clock_timestamp(), clock_timestamp())", [game, home]);
    games.push(game);
    sides.push({ away, home });
  }
  const submit = (playerId, picks, guess = null) => client.query(
    "select public.save_bowl_pool_submission($1, $2, true, $3::jsonb, $4)",
    [playerId, season.id, JSON.stringify(picks.map(([game, side]) => ({ game_id: games[game], team_id: sides[game][side] }))), guess]);
  const pickOf = async (playerId, game) => (await client.query(`
    select pick.selected_team_id, pick.result, pick.submitted_at from public.bowl_pool_picks pick
    join public.bowl_pool_entries entry on entry.id = pick.entry_id
    where entry.player_id = $1 and pick.game_id = $2
  `, [playerId, games[game]])).rows[0];
  return { token, A, B, commissioner, season, games, sides, submit, pickOf };
}

async function inRolledBackTransaction(run) {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    await run(client);
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

test("games kick off one at a time: a player who comes back can change what is still open and nothing else", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, () => inRolledBackTransaction(async (client) => {
  const { A, B, games, sides, season, submit, pickOf } = await startSeason(client);

  // Day 1: A picks every game, away team each time.
  await submit(A, [[0, "away"], [1, "away"], [2, "away"], [3, "away"]]);
  const firstGamePick = await pickOf(A, 0);

  // Game 1 kicks off. Day 2: A comes back and, like the Bowl page, sends only the games still open.
  await kickOff(client, games[0]);
  await submit(A, [[1, "home"], [2, "away"], [3, "away"]]);
  assert.equal((await pickOf(A, 1)).selected_team_id, sides[1].home, "a later game can still be changed");
  const unchanged = await pickOf(A, 0);
  assert.equal(unchanged.selected_team_id, firstGamePick.selected_team_id, "the game that kicked off keeps the pick it had");
  assert.equal(unchanged.submitted_at.toISOString(), firstGamePick.submitted_at.toISOString(), "and it was not rewritten");

  // Leaving a still-open game out removes that pick; leaving the started game out does not.
  await submit(A, [[1, "home"], [3, "away"]]);
  assert.equal(await pickOf(A, 2), undefined, "an open game left out is un-picked");
  assert.ok(await pickOf(A, 0), "a started game left out keeps its pick");

  // Sending the started game's pick again, or changing it, is refused.
  await refuses(client, "started_game_changed", "select public.save_bowl_pool_submission($1, $2, true, $3::jsonb, null)",
    [A, season.id, JSON.stringify([{ game_id: games[0], team_id: sides[0].home }, { game_id: games[1], team_id: sides[1].home }])], /no longer open for selections/);

  // A player who never joined cannot claim a seat once the first game has started.
  await refuses(client, "late_seat", "select public.save_bowl_pool_submission($1, $2, true, '[]'::jsonb, null)", [B, season.id], /closed at the first kickoff/);

  // An unstarted game's matchup and kickoff are frozen once it holds a pick or a locked line.
  await refuses(client, "kickoff_frozen", "update public.bowl_pool_games set kickoff_at = $2 where id = $1", [games[3], at(100 * HOUR)], /cannot be replaced/);
}));

test("a postponed game keeps its picks, can be rescheduled by the Commissioner only, locks its line at 8 AM on the new day, and is open again until the new kickoff", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, () => inRolledBackTransaction(async (client) => {
  const { A, commissioner, games, sides, season, submit, pickOf } = await startSeason(client);
  await submit(A, [[0, "away"], [1, "away"], [2, "away"], [3, "away"]]);

  await client.query("select * from public.record_bowl_game_disruption($1, 'postponed', $2)", [games[1], commissioner]);
  assert.equal((await pickOf(A, 1)).result, "pending", "a postponement does not void the pick");

  // The page no longer sends the postponed game (it is not open), and that must not cost the player the pick.
  await submit(A, [[2, "home"], [3, "away"]]);
  assert.equal((await pickOf(A, 1)).selected_team_id, sides[1].away, "a postponed game's pick survives a Submit that leaves it out");
  await refuses(client, "postponed_pick", "select public.save_bowl_pool_submission($1, $2, true, $3::jsonb, null)",
    [A, season.id, JSON.stringify([{ game_id: games[1], team_id: sides[1].home }])], /no longer open for selections/);

  await refuses(client, "not_commissioner", "select * from public.reschedule_bowl_game($1, $2, $3)", [games[1], at(80 * HOUR), A], /Commissioner access is required/);
  await refuses(client, "in_the_past", "select * from public.reschedule_bowl_game($1, $2, $3)", [games[1], at(-HOUR), commissioner], /must be in the future/);
  await refuses(client, "not_postponed", "select * from public.reschedule_bowl_game($1, $2, $3)", [games[2], at(80 * HOUR), commissioner], /Only postponed/);

  // 7 PM Eastern five days out, so the 8 AM line lock is the same wherever the clock happens to be when this runs.
  const newKickoff = (await one(client, "select ((date_trunc('day', now() at time zone 'America/New_York') + interval '5 days 19 hours') at time zone 'America/New_York') as kickoff")).kickoff.toISOString();
  const rescheduled = await one(client, "select * from public.reschedule_bowl_game($1, $2, $3)", [games[1], newKickoff, commissioner]);
  assert.equal(rescheduled.status, "scheduled");
  assert.equal(rescheduled.kickoff_at.toISOString(), newKickoff);
  assert.equal(rescheduled.time_confirmed, true);
  const eightAm = await one(client, "select (((($1::timestamptz) at time zone 'America/New_York')::date + time '08:00') at time zone 'America/New_York') as lock_at", [newKickoff]);
  assert.equal(rescheduled.line_lock_at.toISOString(), eightAm.lock_at.toISOString(), "the line locks at 8 AM Eastern on the new game day, not at kickoff");
  assert.equal((await pickOf(A, 1)).selected_team_id, sides[1].away, "the pick is kept through the reschedule");
  const line = await one(client, "select locked_spread, locked_at from public.bowl_pool_game_lines where game_id = $1", [games[1]]);
  assert.equal(Number(line.locked_spread), 3.5, "a locked line is not replaced");
  assert.ok(line.locked_at, "and stays locked");
  assert.equal((await one(client, "select count(*)::integer as count from public.bowl_pool_schedule_changes where game_id = $1", [games[1]])).count, 1, "the move is logged for the Commissioner to review");

  await submit(A, [[1, "home"], [2, "home"], [3, "away"]]);
  assert.equal((await pickOf(A, 1)).selected_team_id, sides[1].home, "the rescheduled game is open for changes again");
  await refuses(client, "teams_frozen", "update public.bowl_pool_games set home_team_id = $2 where id = $1", [games[1], sides[0].home], /cannot be replaced/);
}));

test("a cancelled game voids its picks and keeps them in view when the player saves again", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, () => inRolledBackTransaction(async (client) => {
  const { A, B, commissioner, games, submit, pickOf } = await startSeason(client);
  await submit(A, [[0, "away"], [1, "away"], [2, "home"]]);
  await submit(B, [[0, "home"], [2, "home"]]);

  const voided = await one(client, "select * from public.record_bowl_game_disruption($1, 'cancelled', $2)", [games[2], commissioner]);
  assert.equal(voided.picks_voided, 2);
  await submit(A, [[1, "home"]]);
  assert.equal((await pickOf(A, 2))?.result, "void", "the voided pick is still there after the player saves");
  assert.equal((await pickOf(B, 2))?.result, "void");
  assert.equal((await pickOf(A, 1)).result, "pending");
}));

test("the half-point rule: a whole-number spread becomes a half-point one and a pick-em stays a pick-em", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, () => inRolledBackTransaction(async (client) => {
  const normalized = async (value) => (await one(client, "select public.normalize_bowl_pool_spread($1::numeric) as value", [value])).value;
  assert.equal(Number(await normalized(3)), 3.5);
  assert.equal(Number(await normalized(10)), 10.5);
  assert.equal(Number(await normalized(3.5)), 3.5);
  assert.equal(Number(await normalized(0)), 0);
  assert.equal(await normalized(-2), null, "a negative spread is not a spread");
  assert.equal(await normalized(null), null);
}));

test("a reminder's key keeps it from being queued twice, and a cancelled reminder gives its key up so a moved game can queue a new one", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, () => inRolledBackTransaction(async (client) => {
  const { commissioner, games, token } = await startSeason(client);
  const key = `bowl:${token}:pick-due:${games[0]}`;
  const queue = (automationKey, status = "scheduled") => client.query(`
    insert into public.push_reminders (created_by_player_id, category, audience, title, body, scheduled_for, source_game_ids, automation_key, status)
    values ($1, 'bowl_pick_due', 'all_active', 'Bowl Pool pick due soon', 'You still have a Bowl Pool selection to make before kickoff.', $2, $3, $4, $5)
  `, [commissioner, at(HOUR), [games[0]], automationKey, status]);

  await queue(key);
  await client.query("savepoint twice");
  await assert.rejects(() => queue(key), (error) => error.code === "23505", "the same reminder cannot be queued twice");
  await client.query("rollback to savepoint twice");

  // The game moves: its queued reminders are cancelled and let go of their keys (what the schedule pull and the Commissioner's Reschedule do).
  await client.query(`
    update public.push_reminders set status = 'cancelled', cancelled_at = now(), suppression_reason = 'bowl_schedule_changed', automation_key = null
    where category = 'bowl_pick_due' and status = 'scheduled' and source_game_ids @> $1::uuid[]
  `, [[games[0]]]);
  await queue(key);
  const rows = await one(client, "select count(*) filter (where status = 'scheduled')::integer as scheduled, count(*) filter (where status = 'cancelled')::integer as cancelled from public.push_reminders where source_game_ids @> $1::uuid[]", [[games[0]]]);
  assert.deepEqual(rows, { scheduled: 1, cancelled: 1 }, "one fresh reminder for the new time and the old one kept as a record");
}));
