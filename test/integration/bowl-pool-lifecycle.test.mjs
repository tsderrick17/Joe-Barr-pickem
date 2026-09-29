import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

// Runs on every isolated workflow run (same gate as the weekly rehearsal).
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

async function rejects(client, label, sql, values, pattern) {
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

// Moves fixture games into the past without firing triggers, exactly like the
// full-season drills do. Everything happens inside a rolled-back transaction.
async function moveKickoffsIntoThePast(client, seasonId, gameIds) {
  await client.query("set local session_replication_role = replica");
  for (const [index, gameId] of gameIds.entries()) {
    await client.query(
      "update public.bowl_pool_games set kickoff_at = $2, line_lock_at = $2, status = 'live' where id = $1",
      [gameId, at(-(10 - index) * HOUR)],
    );
  }
  await client.query(
    "update public.bowl_pool_seasons set first_kickoff_at = (select min(kickoff_at) from public.bowl_pool_games where season_id = $1) where id = $1",
    [seasonId],
  );
  await client.query("set local session_replication_role = origin");
}

test("isolated Bowl Pool season: entries, locks, grading, disruptions, receipts, and champion", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `bowl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const player = async (name) => (await one(client,
      "insert into public.players(first_name) values ($1) returning id", [`${name} ${token}`])).id;
    const [A, B, C, D, E] = [await player("Bowl A"), await player("Bowl B"), await player("Bowl C"), await player("Bowl D"), await player("Bowl E")];

    const season = await one(client, `
      insert into public.bowl_pool_seasons (season_year, player_visible_at)
      values ($1, $2) returning id
    `, [5000 + Math.floor(Math.random() * 4000), at(-24 * HOUR)]);

    const teams = [];
    for (let index = 0; index < 8; index += 1) {
      teams.push((await one(client, `
        insert into public.bowl_pool_teams (provider_team_id, display_name, short_name, abbreviation)
        values ($1, $2, $3, $4) returning id
      `, [`${token}-t${index}`, `Bowl Team ${index} ${token}`, `T${index}`, `T${index}`])).id);
    }
    const games = [];
    for (let index = 0; index < 4; index += 1) {
      games.push((await one(client, `
        insert into public.bowl_pool_games
          (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, is_cfp, away_team_id, home_team_id)
        values ($1, $2, $3, $4, $4, $5, $6, $7, $8) returning id
      `, [season.id, `${token}-g${index}`, `Test Bowl ${index}`, at((2 + index) * HOUR), index + 1, index === 3, teams[index * 2], teams[index * 2 + 1]])).id);
    }
    const [g1, g2, g3, g4] = games;
    const away = (game) => teams[games.indexOf(game) * 2];
    const home = (game) => teams[games.indexOf(game) * 2 + 1];
    await client.query("update public.bowl_pool_seasons set championship_game_id = $2 where id = $1", [season.id, g4]);

    // g1: home -3.5 · g2: PK · g3: away -7.5 (will be cancelled) · g4 (title game): home -1.5
    const line = (game, favorite, spread) => client.query(`
      insert into public.bowl_pool_game_lines (game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at)
      values ($1, $2, $3, $3, 'bowl-lifecycle-test', clock_timestamp())
    `, [game, favorite, spread]);
    await line(g1, home(g1), 3.5);
    await line(g2, null, 0);
    await line(g3, away(g3), 7.5);
    await line(g4, home(g4), 1.5);

    const firstKickoff = await one(client, "select first_kickoff_at from public.bowl_pool_seasons where id = $1", [season.id]);
    assert.ok(firstKickoff.first_kickoff_at, "the season's first kickoff is tracked automatically");

    const submit = (playerId, optedIn, picks, guess) => client.query(
      "select public.save_bowl_pool_submission($1, $2, $3, $4::jsonb, $5) as entry_id",
      [playerId, season.id, optedIn, JSON.stringify(picks.map(([game_id, team_id]) => ({ game_id, team_id }))), guess],
    );

    // A skips the tiebreaker on purpose; that must never cost them the title.
    await submit(A, true, [[g1, away(g1)], [g2, away(g2)], [g3, away(g3)], [g4, away(g4)]], null);
    await submit(A, true, [[g1, home(g1)], [g2, away(g2)], [g3, away(g3)], [g4, away(g4)]], null);
    await submit(B, true, [[g1, away(g1)], [g2, away(g2)], [g3, home(g3)], [g4, home(g4)]], 60);
    await submit(C, true, [[g1, home(g1)], [g3, away(g3)], [g4, home(g4)]], 49);
    await submit(D, true, [[g1, home(g1)]], 55);
    await submit(D, false, [], null);

    const changed = await one(client, `
      select count(*)::integer as count from public.bowl_pool_pick_history history
      join public.bowl_pool_entries entry on entry.id = history.entry_id
      where entry.player_id = $1 and history.action = 'changed'
    `, [A]);
    assert.equal(changed.count, 1, "a changed selection is audited");

    await rejects(client, "matchup_locked",
      "update public.bowl_pool_games set away_team_id = $2 where id = $1", [g1, teams[7]],
      /cannot be replaced/);

    await moveKickoffsIntoThePast(client, season.id, games);

    await rejects(client, "late_entry",
      "select public.save_bowl_pool_submission($1, $2, true, '[]'::jsonb, 50)", [E, season.id],
      /closed at the first kickoff/);
    await rejects(client, "late_pick_change",
      "select public.save_bowl_pool_submission($1, $2, true, $3::jsonb, null)",
      [A, season.id, JSON.stringify([{ game_id: g1, team_id: away(g1) }, { game_id: g2, team_id: away(g2) }, { game_id: g3, team_id: away(g3) }, { game_id: g4, team_id: away(g4) }])],
      /no longer open for selections/);
    await rejects(client, "late_withdrawal",
      "select public.save_bowl_pool_submission($1, $2, false, '[]'::jsonb, null)", [B, season.id],
      /opt-out closed/);

    const purged = await one(client, "select public.purge_withdrawn_bowl_pool_drafts(clock_timestamp()) as count");
    assert.ok(purged.count >= 1, "a withdrawn player's private draft is deleted at the first kickoff");
    const dPicks = await one(client, `
      select count(*)::integer as count from public.bowl_pool_picks pick
      join public.bowl_pool_entries entry on entry.id = pick.entry_id where entry.player_id = $1
    `, [D]);
    assert.equal(dPicks.count, 0);

    const voided = await one(client, "select * from public.record_bowl_game_disruption($1, 'cancelled', null)", [g3]);
    assert.equal(voided.picks_voided, 3, "every pending pick on a cancelled bowl is voided, not lost");

    // g1: home wins by 4 (covers 3.5) · g2: 17-17 PK tie (a tie is a loss)
    // g4: home wins by 1 (does not cover 1.5, so the away pick wins)
    const final = (game, awayScore, homeScore) => client.query(
      "update public.bowl_pool_games set status = 'final', away_score = $2, home_score = $3, finalized_at = clock_timestamp() where id = $1",
      [game, awayScore, homeScore]);
    await final(g1, 20, 24);
    await final(g2, 17, 17);
    await final(g4, 27, 28);

    const missing = await one(client, "select public.settle_bowl_pool_missing_picks(clock_timestamp()) as count");
    assert.equal(missing.count, 1, "C's skipped PK game becomes one missing-pick loss");

    const graded = await one(client, "select public.grade_bowl_pool_final_picks(clock_timestamp()) as count");
    assert.equal(graded.count, 8);
    const again = await one(client, "select public.grade_bowl_pool_final_picks(clock_timestamp()) as count");
    assert.equal(again.count, 0, "grading is safe to repeat");

    const results = await client.query(`
      select entry.player_id, pick.game_id, pick.result, receipt.result as receipt
      from public.bowl_pool_picks pick
      join public.bowl_pool_entries entry on entry.id = pick.entry_id
      left join public.bowl_pool_game_results receipt on receipt.entry_id = pick.entry_id and receipt.game_id = pick.game_id
      where entry.season_id = $1
    `, [season.id]);
    const resultOf = (playerId, game) => results.rows.find((row) => row.player_id === playerId && row.game_id === game);
    const expected = [
      [A, g1, "win"], [A, g2, "loss"], [A, g3, "void"], [A, g4, "win"],
      [B, g1, "loss"], [B, g2, "loss"], [B, g3, "void"], [B, g4, "loss"],
      [C, g1, "win"], [C, g3, "void"], [C, g4, "loss"],
    ];
    for (const [playerId, game, result] of expected) {
      const row = resultOf(playerId, game);
      assert.equal(row?.result, result, `pick result ${playerId === A ? "A" : playerId === B ? "B" : "C"} game ${games.indexOf(game) + 1}`);
      assert.equal(row?.receipt, result, "every settled pick has a matching result receipt");
    }

    // A receipt lost by the old two-step write is repaired on the next run.
    const aEntry = await one(client, "select id from public.bowl_pool_entries where player_id = $1 and season_id = $2", [A, season.id]);
    await client.query("delete from public.bowl_pool_game_results where entry_id = $1 and game_id = $2", [aEntry.id, g1]);
    await client.query("select public.grade_bowl_pool_final_picks(clock_timestamp())");
    const repaired = await one(client, "select result from public.bowl_pool_game_results where entry_id = $1 and game_id = $2", [aEntry.id, g1]);
    assert.equal(repaired.result, "win");

    // Wins: A 2 (no tiebreaker guess), C 1, B 0. A must win outright.
    const crowned = await one(client, "select public.refresh_bowl_pool_champion($1, clock_timestamp()) as count", [season.id]);
    assert.equal(crowned.count, 1);
    const champion = await one(client, "select player_id, wins, championship_total_guess, final_total_difference from public.bowl_pool_championships where season_id = $1", [season.id]);
    assert.equal(champion.player_id, A, "the most wins wins, even without a tiebreaker guess");
    assert.equal(champion.wins, 2);
    assert.equal(champion.championship_total_guess, null);
    const trophy = await one(client, "select count(*)::integer as count from public.pool_championships where pool = 'bowl' and player_id = $1", [A]);
    assert.equal(trophy.count, 1);
    const rerun = await one(client, "select public.refresh_bowl_pool_champion($1, clock_timestamp()) as count", [season.id]);
    assert.equal(rerun.count, 0, "crowning is safe to repeat");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});

test("isolated Bowl Pool tiebreaker: closest guess wins a tie, a missing guess loses it, no guesses share it", {
  skip: !enabled && "Set the isolated PICKEM_TEST_* variables with PICKEM_WEEKLY_REHEARSAL=true.",
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");

  try {
    const token = `bowl-tie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    async function crownFor(guesses) {
      await client.query("savepoint scenario");
      const season = await one(client, "insert into public.bowl_pool_seasons (season_year, player_visible_at) values ($1, $2) returning id",
        [5000 + Math.floor(Math.random() * 4000), at(-24 * HOUR)]);
      const t1 = (await one(client, "insert into public.bowl_pool_teams (provider_team_id, display_name, short_name) values ($1, $1, 'X') returning id", [`${token}-${season.id}-x`])).id;
      const t2 = (await one(client, "insert into public.bowl_pool_teams (provider_team_id, display_name, short_name) values ($1, $1, 'Y') returning id", [`${token}-${season.id}-y`])).id;
      const game = (await one(client, `
        insert into public.bowl_pool_games (season_id, provider_game_id, bowl_name, kickoff_at, line_lock_at, away_team_id, home_team_id)
        values ($1, $2, 'Title', $3, $3, $4, $5) returning id
      `, [season.id, `${token}-${season.id}`, at(2 * HOUR), t1, t2])).id;
      await client.query("update public.bowl_pool_seasons set championship_game_id = $2 where id = $1", [season.id, game]);
      await client.query("insert into public.bowl_pool_game_lines (game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at) values ($1, $2, 3.5, 3.5, 'tie-test', clock_timestamp())", [game, t2]);
      const players = [];
      for (const [index, guess] of guesses.entries()) {
        const id = (await one(client, "insert into public.players(first_name) values ($1) returning id", [`Tie ${index} ${token}`])).id;
        players.push(id);
        await client.query("select public.save_bowl_pool_submission($1, $2, true, $3::jsonb, $4)",
          [id, season.id, JSON.stringify([{ game_id: game, team_id: t2 }]), guess]);
      }
      await moveKickoffsIntoThePast(client, season.id, [game]);
      await client.query("update public.bowl_pool_games set status = 'final', away_score = 20, home_score = 30, finalized_at = clock_timestamp() where id = $1", [game]);
      await client.query("select public.grade_bowl_pool_final_picks(clock_timestamp())");
      await client.query("select public.refresh_bowl_pool_champion($1, clock_timestamp())", [season.id]);
      const winners = await client.query("select player_id from public.bowl_pool_championships where season_id = $1", [season.id]);
      await client.query("rollback to savepoint scenario");
      return winners.rows.map((row) => players.indexOf(row.player_id)).sort();
    }

    // Everyone has one win; the final total is 50.
    assert.deepEqual(await crownFor([48, 55, null]), [0], "closest guess wins; a missing guess loses the tiebreaker");
    assert.deepEqual(await crownFor([47, 53]), [0, 1], "equally close guesses are co-champions");
    assert.deepEqual(await crownFor([null, null]), [0, 1], "if no leader guessed, the leaders are co-champions");
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
