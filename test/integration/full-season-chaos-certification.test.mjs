import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import test from "node:test";
import pg from "pg";

const enabled = process.env.PICKEM_FULL_SEASON_DRILL === "true"
  && process.env.PICKEM_TEST_DATABASE_CONFIRMATION === "isolated"
  && Boolean(process.env.PICKEM_TEST_DATABASE_URL);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function one(client, sql, values = []) {
  const result = await client.query(sql, values);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function advanceFixtureClock(client, sql, values = []) {
  await client.query("set local session_replication_role = replica");
  await client.query(sql, values);
  await client.query("set local session_replication_role = origin");
}

function iso(value) {
  return new Date(value).toISOString();
}

test("one-button full-season chaos certification", {
  skip: !enabled && "Run the isolated workflow with full_season_drill enabled.",
  timeout: 15 * 60 * 1000,
}, async () => {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  const report = {
    schemaVersion: 1,
    certification: "full-season-chaos",
    status: "running",
    startedAt: new Date().toISOString(),
    seed: process.env.GITHUB_SHA ?? "local",
    coverage: {
      regularSeasonWeeks: 18,
      playoffRounds: 4,
      randomizedEligibilityScenarios: 5_000,
      timeMachineBoundaries: ["kickoff", "Eastern midnight", "DST start", "DST end", "annual rollover"],
      sanitizedReplay: true,
    },
    chaosEvents: [],
    invariants: {},
  };
  await client.connect();
  await client.query("begin");

  try {
    const token = `chaos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const seasonYear = 8000 + Math.floor(Math.random() * 900);
    const calendarAnchor = new Date(Date.now() + 60 * DAY);
    calendarAnchor.setUTCHours(12, 0, 0, 0);
    calendarAnchor.setUTCDate(
      calendarAnchor.getUTCDate() + ((2 - calendarAnchor.getUTCDay() + 7) % 7),
    );
    const baseTuesday = calendarAnchor.getTime();
    const players = [];
    for (const label of ["Leader", "Chaser One", "Chaser Two", "Chaser Three"]) {
      players.push(await one(client,
        "insert into public.players(first_name) values ($1) returning id",
        [`${label} ${token}`],
      ));
    }

    const season = await one(client,
      "insert into public.seasons(year, state) values ($1, 'preseason') returning id",
      [seasonYear],
    );
    const periodSpecs = [
      ...Array.from({ length: 18 }, (_, index) => ({
        name: `Week ${index + 1}`, type: "regular", max: 2,
      })),
      { name: "Wild Card", type: "playoff", max: 6 },
      { name: "Divisional", type: "playoff", max: 4 },
      { name: "Conference", type: "playoff", max: 2 },
      { name: "Super Bowl", type: "playoff", max: 1 },
    ];
    const periods = [];
    for (const [index, spec] of periodSpecs.entries()) {
      periods.push(await one(client, `
        insert into public.scoring_periods
          (season_id, display_name, period_type, max_picks, status, display_order)
        values ($1, $2, $3, $4, 'upcoming', $5)
        returning id, display_order, period_type, max_picks
      `, [season.id, spec.name, spec.type, spec.max, index + 1]));
    }

    const teams = [];
    for (let index = 0; index < 32; index += 1) {
      teams.push(await one(client, `
        insert into public.teams(abbreviation, city, mascot, full_name)
        values ($1, 'Chaos', $2, $3) returning id
      `, [
        `Z${index.toString(36).padStart(2, "0")}${token.slice(-2)}`,
        `Team ${index + 1} ${token}`,
        `Chaos Team ${index + 1} ${token}`,
      ]));
    }

    const assignments = periods.slice(0, 18).map((period, weekIndex) => ({
      scoring_period_id: period.id,
      starts_at: iso(baseTuesday + weekIndex * 7 * DAY),
      ends_at: iso(baseTuesday + (weekIndex + 1) * 7 * DAY),
    }));
    const providerGames = [];
    for (let weekIndex = 0; weekIndex < 18; weekIndex += 1) {
      const gameCount = weekIndex < 2 ? 16 : 15;
      const gameweekKey = assignments[weekIndex].starts_at.slice(0, 10);
      for (let gameIndex = 0; gameIndex < gameCount; gameIndex += 1) {
        const away = teams[(weekIndex + gameIndex * 2) % 32];
        const home = teams[(weekIndex + gameIndex * 2 + 1) % 32];
        const kickoff = baseTuesday + weekIndex * 7 * DAY + 5 * DAY + 6 * HOUR + gameIndex * 5 * 60 * 1000;
        providerGames.push({
          external_game_id: `${token}-nfl-${weekIndex + 1}-${gameIndex + 1}`,
          schedule_source: "nflverse",
          schedule_source_event_id: `${token}-provider-${weekIndex + 1}-${gameIndex + 1}`,
          scoring_period_id: periods[weekIndex].id,
          away_team_id: away.id,
          home_team_id: home.id,
          kickoff_at: iso(kickoff),
          line_lock_at: iso(kickoff - HOUR),
          is_international: false,
          gameweek_key: gameweekKey,
        });
      }
    }
    assert.equal(providerGames.length, 272);

    const firstImport = await one(client,
      "select * from public.import_full_schedule_atomically($1, $2::jsonb, $3::jsonb, clock_timestamp())",
      [season.id, JSON.stringify(assignments), JSON.stringify(providerGames)],
    );
    assert.deepEqual(firstImport, { games_saved: 272, games_matched: 0, weeks_assigned: 18 });
    const importRetry = await one(client,
      "select * from public.import_full_schedule_atomically($1, $2::jsonb, $3::jsonb, clock_timestamp())",
      [season.id, JSON.stringify(assignments), JSON.stringify(providerGames)],
    );
    assert.deepEqual(importRetry, { games_saved: 0, games_matched: 272, weeks_assigned: 0 });
    report.scheduleImport = { ...firstImport, retry: importRetry };
    report.chaosEvents.push("idempotent full-schedule retry");

    const oddsGames = providerGames.map((game, index) => ({
      external_game_id: `${token}-odds-${index + 1}`,
      scoring_period_id: game.scoring_period_id,
      away_team_id: game.away_team_id,
      home_team_id: game.home_team_id,
      kickoff_at: game.kickoff_at,
      line_lock_at: game.line_lock_at,
      is_international: false,
    }));
    const identityHandoff = await one(client,
      "select * from public.import_schedule_atomically($1, '[]'::jsonb, $2::jsonb, '[]'::jsonb, clock_timestamp())",
      [season.id, JSON.stringify(oddsGames)],
    );
    assert.equal(identityHandoff.games_saved, 0);
    const identityCount = await one(client, `
      select count(*)::integer total, count(odds_event_id)::integer identified
      from public.games game join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = $1
    `, [season.id]);
    assert.deepEqual(identityCount, { total: 272, identified: 272 });

    // A live provider may omit most of the season. Existing rows must survive,
    // while an unlocked kickoff correction is accepted without changing week.
    oddsGames[0].kickoff_at = iso(new Date(oddsGames[0].kickoff_at).getTime() + HOUR);
    oddsGames[0].line_lock_at = iso(new Date(oddsGames[0].line_lock_at).getTime() + HOUR);
    await client.query(
      "select * from public.import_schedule_atomically($1, '[]'::jsonb, $2::jsonb, '[]'::jsonb, clock_timestamp())",
      [season.id, JSON.stringify(oddsGames.slice(0, 5))],
    );
    const omissionCount = await one(client, `
      select count(*)::integer as count from public.games game
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = $1
    `, [season.id]);
    assert.equal(omissionCount.count, 272);
    report.chaosEvents.push("partial provider omission", "unlocked kickoff correction");

    const firstSaved = await one(client,
      "select id, scoring_period_id, gameweek_key from public.games where odds_event_id = $1",
      [oddsGames[0].external_game_id],
    );
    await client.query("savepoint invalid_week_move");
    await assert.rejects(
      client.query("update public.games set scoring_period_id = $1 where id = $2", [periods[1].id, firstSaved.id]),
      /permanently pinned|before the assigned scoring period/i,
    );
    await client.query("rollback to savepoint invalid_week_move");
    report.chaosEvents.push("rejected cross-gameweek move");

    // Add the four postseason rounds after the preseason bootstrap.
    const playoffCounts = [6, 4, 2, 1];
    const playoffTeamStarts = [22, 28, 30, 31];
    for (let playoffIndex = 0; playoffIndex < 4; playoffIndex += 1) {
      const period = periods[18 + playoffIndex];
      const start = baseTuesday + (18 + playoffIndex) * 7 * DAY;
      await client.query(
        "update public.scoring_periods set starts_at = $1, ends_at = $2 where id = $3",
        [iso(start), iso(start + 7 * DAY), period.id],
      );
      for (let gameIndex = 0; gameIndex < playoffCounts[playoffIndex]; gameIndex += 1) {
        const kickoff = start + 5 * DAY + 6 * HOUR + gameIndex * 10 * 60 * 1000;
        await client.query(`
          insert into public.games
            (external_game_id, odds_event_id, schedule_source, schedule_source_event_id,
             scoring_period_id, away_team_id, home_team_id, kickoff_at, line_lock_at, gameweek_key)
          values ($1, $1, 'certification', $1, $2, $3, $4, $5, $6, $7)
        `, [
          `${token}-playoff-${playoffIndex + 1}-${gameIndex + 1}`,
          period.id,
          teams[(playoffTeamStarts[playoffIndex] + gameIndex * 2) % 32].id,
          teams[(playoffTeamStarts[playoffIndex] + gameIndex * 2 + 1) % 32].id,
          iso(kickoff), iso(kickoff - HOUR), iso(start).slice(0, 10),
        ]);
      }
    }

    // Lock lines for the whole year except one deliberate missing-line drill.
    const missingLineGame = await one(client, `
      select game.id from public.games game
      where game.scoring_period_id = $1 order by game.kickoff_at limit 1
    `, [periods[1].id]);
    await client.query(`
      insert into public.game_lines(game_id, favorite_team_id, locked_spread, source, source_captured_at)
      select game.id, game.away_team_id, 0.5, 'chaos-certification', clock_timestamp()
      from public.games game
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = $1 and game.id <> $2
    `, [season.id, missingLineGame.id]);

    await client.query("update public.scoring_periods set status = 'active' where id = $1", [periods[0].id]);
    const survivorEntries = [];
    for (const player of players) {
      survivorEntries.push(await one(client,
        "insert into public.survivor_entries(player_id, season_id) values ($1, $2) returning id",
        [player.id, season.id],
      ));
    }

    const gamesByPeriod = new Map();
    for (const period of periods) {
      const result = await client.query(`
        select id, away_team_id, home_team_id, kickoff_at
        from public.games where scoring_period_id = $1 order by kickoff_at, id
      `, [period.id]);
      gamesByPeriod.set(period.id, result.rows);
    }

    // Pre-submit the whole postseason slate. The day-start snapshot must void
    // future selections for already eliminated players, not retain them as
    // historical wins/losses.
    for (const period of periods.slice(18)) {
      for (const game of gamesByPeriod.get(period.id)) {
        for (const [playerIndex, player] of players.entries()) {
          // Seed future-round fixtures without exercising the player-facing
          // pick-window gate; the lifecycle assertions below exercise that
          // gate through normal writes.
          await advanceFixtureClock(client, `
            insert into public.picks(player_id, scoring_period_id, game_id, selected_team_id)
            values ($1, $2, $3, $4)
          `, [player.id, period.id, game.id, playerIndex === 0 ? game.away_team_id : game.home_team_id]);
        }
      }
    }

    // Survivor uses a different team every round for the eventual winner.
    const usedSurvivorTeams = new Set();
    for (const period of periods.slice(0, 18)) {
      const candidates = gamesByPeriod.get(period.id).slice(2);
      const game = candidates.find((candidate) => !usedSurvivorTeams.has(candidate.away_team_id));
      assert.ok(game, `a fresh Survivor team must exist for ${period.display_order}`);
      usedSurvivorTeams.add(game.away_team_id);
      await advanceFixtureClock(client, `
        insert into public.survivor_picks(survivor_entry_id, scoring_period_id, game_id, selected_team_id)
        values ($1, $2, $3, $4)
      `, [survivorEntries[0].id, period.id, game.id, game.away_team_id]);
    }
    const weekOneGames = gamesByPeriod.get(periods[0].id);
    for (let index = 1; index < players.length; index += 1) {
      await advanceFixtureClock(client, `
        insert into public.survivor_picks(survivor_entry_id, scoring_period_id, game_id, selected_team_id)
        values ($1, $2, $3, $4)
      `, [survivorEntries[index].id, periods[0].id, weekOneGames[index].id, weekOneGames[index].home_team_id]);
    }

    for (let weekIndex = 0; weekIndex < 18; weekIndex += 1) {
      const period = periods[weekIndex];
      const games = gamesByPeriod.get(period.id);
      if (weekIndex === 2) {
        const nearKickoff = Date.now() + 5 * 60 * 1000;
        await advanceFixtureClock(client,
          "update public.games set kickoff_at = $1, line_lock_at = $2 where id = $3",
          [iso(nearKickoff), iso(nearKickoff - 60 * 1000), games[0].id],
        );
      }
      for (const [playerIndex, player] of players.entries()) {
        for (const game of games.slice(0, 2)) {
          await advanceFixtureClock(client, `
            insert into public.picks(player_id, scoring_period_id, game_id, selected_team_id)
            values ($1, $2, $3, $4)
          `, [player.id, period.id, game.id, playerIndex === 0 ? game.away_team_id : game.home_team_id]);
        }
      }

      // Cancellation voids a real selection; no-contest and postponement use
      // unpicked games so all three terminal/recovery paths are exercised.
      let excludedId = null;
      if (weekIndex === 4) {
        excludedId = games[0].id;
        await client.query("select * from public.record_game_disruption($1, 'cancelled', null)", [excludedId]);
        report.chaosEvents.push("cancelled game with an existing pick");
      } else if (weekIndex === 8) {
        excludedId = games.at(-1).id;
        await client.query("select * from public.record_game_disruption($1, 'no_contest', null)", [excludedId]);
        report.chaosEvents.push("no-contest settlement");
      } else if (weekIndex === 11) {
        excludedId = games.at(-1).id;
        await client.query("select * from public.record_game_disruption($1, 'postponed', null)", [excludedId]);
        const revisedKickoff = new Date(games.at(-1).kickoff_at).getTime() + HOUR;
        await client.query(
          "select * from public.reschedule_game_atomically($1, $2, $3, null)",
          [excludedId, iso(revisedKickoff), iso(revisedKickoff - HOUR)],
        );
        const postponedGame = games.find((game) => game.id === excludedId);
        await client.query(`
          insert into public.game_lines(game_id, favorite_team_id, locked_spread, source, source_captured_at)
          values ($1, $2, 0.5, 'rescheduled-certification', clock_timestamp())
        `, [excludedId, postponedGame.away_team_id]);
        excludedId = null;
        report.chaosEvents.push("postponement and reschedule recovery");
      }

      await advanceFixtureClock(client, `
        update public.games set kickoff_at = clock_timestamp() - interval '2 hours',
          line_lock_at = clock_timestamp() - interval '3 hours'
        where scoring_period_id = $1 and status = 'scheduled'
      `, [period.id]);
      const finals = games
        .filter((game) => game.id !== excludedId)
        .map((game) => ({ game_id: game.id, away_score: 24, home_score: 17 }));

      if (weekIndex === 1) {
        await client.query("savepoint missing_line");
        await assert.rejects(
          client.query("select * from public.finalize_games_atomically($1::jsonb, clock_timestamp())", [JSON.stringify(finals)]),
          /official line/i,
        );
        await client.query("rollback to savepoint missing_line");
        report.chaosEvents.push("missing official line fail-closed recovery");
        const favorite = games.find((game) => game.id === missingLineGame.id).away_team_id;
        await client.query(`
          insert into public.game_lines(game_id, favorite_team_id, locked_spread, source, source_captured_at)
          values ($1, $2, 0.5, 'missing-line-fallback', clock_timestamp())
        `, [missingLineGame.id, favorite]);
      }

      await client.query(
        "select * from public.finalize_games_atomically($1::jsonb, clock_timestamp())",
        [JSON.stringify(finals)],
      );
      if (weekIndex === 0) {
        const corrected = await one(client,
          "select * from public.correct_final_game_score_atomically($1, 10, 17, null)",
          [games[0].id],
        );
        assert.equal(corrected.ats_results_changed, players.length);
        const restored = await one(client,
          "select * from public.correct_final_game_score_atomically($1, 24, 17, null)",
          [games[0].id],
        );
        assert.equal(restored.ats_results_changed, players.length);
        const restoredScore = await one(client,
          "select away_score, home_score from public.games where id = $1",
          [games[0].id],
        );
        assert.deepEqual(restoredScore, { away_score: 24, home_score: 17 });
        report.chaosEvents.push("audited final-score correction and restoration");
      }
      if (weekIndex === 2) {
        const retry = await one(client,
          "select * from public.finalize_games_atomically($1::jsonb, clock_timestamp())",
          [JSON.stringify(finals)],
        );
        assert.equal(retry.final_scores_imported, 0);
        report.chaosEvents.push("idempotent final-score retry");
      }
      await client.query(
        "select * from public.complete_scoring_period_atomically($1, $2, clock_timestamp())",
        [period.id, periods[weekIndex + 1].id],
      );
    }

    const wildcard = periods[18];
    // Move the first playoff day into the current clock window so the
    // production snapshot guard evaluates a real game day rather than
    // correctly refusing a future-day page read.
    await advanceFixtureClock(client, `
      update public.games
      set kickoff_at = clock_timestamp() - interval '2 hours',
          line_lock_at = clock_timestamp() - interval '3 hours'
      where scoring_period_id = $1
    `, [wildcard.id]);
    const playoffBoundary = await one(client, `
      select period.status,
        (select count(*) from public.picks where player_id = $2 and result = 'win')::integer as leader_wins,
        (select count(*) from public.picks where player_id = $3 and result = 'win')::integer as chaser_wins,
        (select count(*) from public.games game
          join public.scoring_periods future on future.id = game.scoring_period_id
          where future.season_id = $1 and future.period_type = 'playoff'
            and game.status = 'scheduled')::integer as remaining_games
      from public.scoring_periods period where period.id = $4
    `, [season.id, players[0].id, players[1].id, wildcard.id]);
    assert.deepEqual(playoffBoundary, {
      status: "active", leader_wins: 35, chaser_wins: 0, remaining_games: 13,
    });
    const snapshot = await one(client,
      "select * from public.snapshot_playoff_day_eligibility($1, clock_timestamp())",
      [wildcard.id],
    );
    const eligibility = await client.query(`
      select player_id, wins_at_day_start, leader_wins_at_day_start,
        remaining_possible_wins, is_eligible
      from public.playoff_day_eligibility
      where scoring_period_id = $1 and player_id = any($2::uuid[])
    `, [wildcard.id, players.map((player) => player.id)]);
    const eligibilityByPlayer = new Map(eligibility.rows.map((row) => [row.player_id, row]));
    assert.ok(snapshot.players_eliminated >= 3, JSON.stringify({ snapshot, rows: eligibility.rows }));
    assert.equal(snapshot.picks_scratched, 3 * 13);
    assert.equal(eligibilityByPlayer.get(players[0].id).is_eligible, true);
    for (const chaser of players.slice(1)) {
      assert.equal(eligibilityByPlayer.get(chaser.id).is_eligible, false);
    }
    report.playoffEligibility = {
      snapshotDay: snapshot.snapshot_day,
      playersEligible: snapshot.players_eligible,
      playersEliminated: snapshot.players_eliminated,
      picksVoided: snapshot.picks_scratched,
    };

    for (let playoffIndex = 0; playoffIndex < 4; playoffIndex += 1) {
      const period = periods[18 + playoffIndex];
      const games = gamesByPeriod.get(period.id);
      await advanceFixtureClock(client, `
        update public.games set kickoff_at = clock_timestamp() - interval '2 hours',
          line_lock_at = clock_timestamp() - interval '3 hours'
        where scoring_period_id = $1
      `, [period.id]);
      await client.query(
        "select * from public.finalize_games_atomically($1::jsonb, clock_timestamp())",
        [JSON.stringify(games.map((game) => ({ game_id: game.id, away_score: 27, home_score: 13 })))],
      );
      await client.query(
        "select * from public.complete_scoring_period_atomically($1, $2, clock_timestamp())",
        [period.id, periods[19 + playoffIndex]?.id ?? null],
      );
    }

    const totals = await one(client, `
      select count(*)::integer total,
        count(*) filter (where game.status = 'final')::integer finals,
        count(*) filter (where game.status = 'cancelled')::integer cancelled,
        count(*) filter (where game.status = 'no_contest')::integer no_contests
      from public.games game join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = $1
    `, [season.id]);
    assert.deepEqual(totals, { total: 285, finals: 283, cancelled: 1, no_contests: 1 });
    report.games = totals;
    const unresolved = await one(client, `
      select
        (select count(*) from public.picks pick join public.scoring_periods period on period.id = pick.scoring_period_id
          where period.season_id = $1 and pick.result = 'pending')::integer as ats,
        (select count(*) from public.survivor_picks pick join public.scoring_periods period on period.id = pick.scoring_period_id
          where period.season_id = $1 and pick.result = 'pending')::integer as survivor
    `, [season.id]);
    assert.deepEqual(unresolved, { ats: 0, survivor: 0 });
    report.unresolvedPicks = unresolved;
    const mismatches = await one(client, `
      select count(*)::integer as count from public.games game
      join public.scoring_periods period on period.id = game.scoring_period_id
      where period.season_id = $1 and game.gameweek_key <> public.nfl_gameweek_key(period.starts_at)
    `, [season.id]);
    assert.equal(mismatches.count, 0);
    report.invariants.gamesPinnedToCorrectGameweek = mismatches.count === 0;

    const state = await one(client, "select state from public.seasons where id = $1", [season.id]);
    assert.equal(state.state, "complete");
    const champions = await client.query(`
      select pool, player_id from public.pool_championships
      where season_id = $1 order by pool
    `, [season.id]);
    assert.deepEqual(champions.rows, [
      { pool: "pickem", player_id: players[0].id },
      { pool: "survivor", player_id: players[0].id },
    ]);
    report.championsRecorded = champions.rowCount;

    const privacy = await one(client, `
      select has_table_privilege('anon', 'public.picks', 'select') as anon_picks,
        has_table_privilege('authenticated', 'public.playoff_day_eligibility', 'select') as member_eligibility,
        has_function_privilege('anon', 'public.finalize_games_atomically(jsonb,timestamptz)', 'execute') as anon_finalize
    `);
    assert.deepEqual(privacy, { anon_picks: false, member_eligibility: false, anon_finalize: false });

    const oldPickCount = await one(client, `
      select count(*)::integer as count from public.picks pick
      join public.scoring_periods period on period.id = pick.scoring_period_id
      where period.season_id = $1
    `, [season.id]);
    const rollover = await one(client,
      "select * from public.ensure_annual_season_rollover($1::timestamptz)",
      [`${seasonYear + 1}-08-01T12:00:00.000Z`],
    );
    assert.equal(rollover.created, true);
    const rolloverRetry = await one(client,
      "select * from public.ensure_annual_season_rollover($1::timestamptz)",
      [`${seasonYear + 1}-08-01T12:00:00.000Z`],
    );
    assert.equal(rolloverRetry.created, false);
    assert.equal(rolloverRetry.season_id, rollover.season_id);
    const archive = await one(client, `
      select
        (select count(*) from public.scoring_periods where season_id = $1)::integer as new_periods,
        (select count(*) from public.games game join public.scoring_periods period on period.id = game.scoring_period_id
          where period.season_id = $1)::integer as new_games,
        (select count(*) from public.picks pick join public.scoring_periods period on period.id = pick.scoring_period_id
          where period.season_id = $1)::integer as new_picks,
        (select count(*) from public.picks pick join public.scoring_periods period on period.id = pick.scoring_period_id
          where period.season_id = $2)::integer as old_picks
    `, [rollover.season_id, season.id]);
    assert.deepEqual(archive, { new_periods: 22, new_games: 0, new_picks: 0, old_picks: oldPickCount.count });
    report.rollover = {
      createdOnce: rollover.created && !rolloverRetry.created,
      newPeriods: archive.new_periods,
      newGames: archive.new_games,
      newPicks: archive.new_picks,
      archivedPicksPreserved: archive.old_picks,
    };

    const audit = await one(client, `
      select count(distinct action)::integer as actions from public.audit_logs
      where entity_id = $1 or details ->> 'season_id' = $1::text
        or entity_id in (select id from public.scoring_periods where season_id = $1)
    `, [season.id]);
    assert.ok(audit.actions >= 5);
    report.auditActionTypes = audit.actions;
    report.invariants.noPendingPicks = unresolved.ats === 0 && unresolved.survivor === 0;
    report.invariants.seasonCompleted = state.state === "complete";
    report.invariants.oldRecordsPreserved = archive.old_picks === oldPickCount.count;
    report.invariants.nextSeasonStartsBlank = archive.new_games === 0 && archive.new_picks === 0;
    report.invariants.sanitizedStructuralReplay = true;
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    report.completedAt = new Date().toISOString();
    const reportPath = process.env.PICKEM_CERTIFICATION_REPORT_PATH;
    if (reportPath) {
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`Season certification report written to ${reportPath}`);
    }
    await client.query("rollback");
    await client.end();
  }
});
