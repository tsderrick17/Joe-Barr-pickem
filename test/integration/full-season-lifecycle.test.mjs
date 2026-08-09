import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedClients,
  isolatedTestConfig,
  testToken,
} from "./test-supabase.mjs";

const config = isolatedTestConfig();
const enabled = Boolean(config) && process.env.PICKEM_FULL_SEASON_DRILL === "true";

function iso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

test("isolated full season preserves scoring, day-start playoff eligibility, history, and rollover", {
  skip: !enabled && "Run the manual isolated workflow with full_season_drill enabled.",
}, async () => {
  const { admin, publicClient } = createIsolatedClients(config);
  const token = testToken();
  const seasonYear = 6000 + Math.floor(Math.random() * 1000);
  const teamRows = Array.from({ length: 12 }, (_, index) => ({
    abbreviation: `${token.slice(-2)}${index.toString(36)}`.toUpperCase(),
    city: "Lifecycle",
    mascot: `Team ${index + 1} ${token}`,
    full_name: `Lifecycle Team ${index + 1} ${token}`,
  }));

  const { data: players, error: playersError } = await admin
    .from("players")
    .insert([
      { first_name: `Lifecycle Leader ${token}` },
      { first_name: `Lifecycle Chaser ${token}` },
    ])
    .select("id, first_name");
  assert.equal(playersError, null, playersError?.message);
  const leaderId = players[0].id;
  const chaserId = players[1].id;

  const { data: season, error: seasonError } = await admin
    .from("seasons")
    .insert({ year: seasonYear, state: "preseason" })
    .select("id, state")
    .single();
  assert.equal(seasonError, null, seasonError?.message);

  const { data: regularPeriod, error: regularError } = await admin
    .from("scoring_periods")
    .insert({
      season_id: season.id,
      display_name: "Lifecycle Regular Season",
      period_type: "regular",
      max_picks: 3,
      status: "active",
      display_order: 1,
    })
    .select("id")
    .single();
  assert.equal(regularError, null, regularError?.message);

  const { data: playoffPeriod, error: playoffError } = await admin
    .from("scoring_periods")
    .insert({
      season_id: season.id,
      display_name: "Lifecycle Playoff Weekend",
      period_type: "playoff",
      max_picks: 3,
      status: "upcoming",
      display_order: 2,
    })
    .select("id")
    .single();
  assert.equal(playoffError, null, playoffError?.message);

  const { data: startedSeason } = await admin
    .from("seasons")
    .select("state")
    .eq("id", season.id)
    .single();
  assert.equal(startedSeason.state, "regular_season", "activating a regular period must start the season automatically");

  const { data: teams, error: teamsError } = await admin
    .from("teams")
    .insert(teamRows)
    .select("id");
  assert.equal(teamsError, null, teamsError?.message);

  const futureKickoff = iso(48 * 60 * 60 * 1000);
  const gamesToInsert = Array.from({ length: 6 }, (_, index) => ({
    external_game_id: `${token}-game-${index + 1}`,
    scoring_period_id: index < 3 ? regularPeriod.id : playoffPeriod.id,
    away_team_id: teams[index * 2].id,
    home_team_id: teams[index * 2 + 1].id,
    kickoff_at: futureKickoff,
    line_lock_at: iso(47 * 60 * 60 * 1000),
  }));
  const { data: games, error: gamesError } = await admin
    .from("games")
    .insert(gamesToInsert)
    .select("id, scoring_period_id, away_team_id, home_team_id")
    .order("external_game_id");
  assert.equal(gamesError, null, gamesError?.message);

  const { error: linesError } = await admin.from("game_lines").insert(
    games.map((game) => ({
      game_id: game.id,
      favorite_team_id: game.away_team_id,
      locked_spread: 0.5,
      source: "full-season-lifecycle-drill",
      source_captured_at: new Date().toISOString(),
    })),
  );
  assert.equal(linesError, null, linesError?.message);

  const picks = games.flatMap((game) => [
    {
      player_id: leaderId,
      scoring_period_id: game.scoring_period_id,
      game_id: game.id,
      selected_team_id: game.away_team_id,
    },
    {
      player_id: chaserId,
      scoring_period_id: game.scoring_period_id,
      game_id: game.id,
      selected_team_id: game.home_team_id,
    },
  ]);
  const { error: picksError } = await admin.from("picks").insert(picks);
  assert.equal(picksError, null, picksError?.message);

  const regularGames = games.filter((game) => game.scoring_period_id === regularPeriod.id);
  const playoffGames = games.filter((game) => game.scoring_period_id === playoffPeriod.id);
  const { error: moveRegularError } = await admin
    .from("games")
    .update({ kickoff_at: iso(-72 * 60 * 60 * 1000), line_lock_at: iso(-73 * 60 * 60 * 1000) })
    .in("id", regularGames.map((game) => game.id));
  assert.equal(moveRegularError, null, moveRegularError?.message);

  const { data: regularFinal, error: regularFinalError } = await admin.rpc("finalize_games_atomically", {
    final_games: regularGames.map((game) => ({ game_id: game.id, away_score: 24, home_score: 17 })),
    accepted_at: new Date().toISOString(),
  });
  assert.equal(regularFinalError, null, regularFinalError?.message);
  assert.deepEqual(regularFinal[0], { final_scores_imported: 3, ats_picks_graded: 6, survivor_picks_graded: 0 });

  const { error: movePlayoffError } = await admin
    .from("games")
    .update({ kickoff_at: iso(-24 * 60 * 60 * 1000), line_lock_at: iso(-25 * 60 * 60 * 1000) })
    .in("id", playoffGames.slice(0, 2).map((game) => game.id));
  assert.equal(movePlayoffError, null, movePlayoffError?.message);
  const { error: moveFinalPlayoffError } = await admin
    .from("games")
    .update({ kickoff_at: iso(24 * 60 * 60 * 1000), line_lock_at: iso(23 * 60 * 60 * 1000) })
    .eq("id", playoffGames[2].id);
  assert.equal(moveFinalPlayoffError, null, moveFinalPlayoffError?.message);

  const { error: regularHandoffError } = await admin.rpc("complete_scoring_period_atomically", {
    target_scoring_period_id: regularPeriod.id,
    next_scoring_period_id: playoffPeriod.id,
    rollover_at: new Date().toISOString(),
  });
  assert.equal(regularHandoffError, null, regularHandoffError?.message);

  const { data: playoffSeason } = await admin.from("seasons").select("state").eq("id", season.id).single();
  assert.equal(playoffSeason.state, "playoffs", "activating the playoff period must transition the season automatically");

  const { error: firstSnapshotError } = await admin.rpc("snapshot_playoff_day_eligibility", {
    target_scoring_period_id: playoffPeriod.id,
    evaluated_at: iso(-36 * 60 * 60 * 1000),
  });
  assert.equal(firstSnapshotError, null, firstSnapshotError?.message);
  const { data: firstEligibility, error: firstEligibilityError } = await admin
    .from("playoff_day_eligibility")
    .select("player_id, is_eligible")
    .eq("scoring_period_id", playoffPeriod.id)
    .in("player_id", [leaderId, chaserId])
    .order("player_id");
  assert.equal(firstEligibilityError, null, firstEligibilityError?.message);
  assert.equal(firstEligibility.length, 2);
  assert.ok(firstEligibility.every((row) => row.is_eligible), "both players can still tie at the first playoff day start");

  const { data: dayOneFinal, error: dayOneFinalError } = await admin.rpc("finalize_games_atomically", {
    final_games: playoffGames.slice(0, 2).map((game) => ({ game_id: game.id, away_score: 27, home_score: 10 })),
    accepted_at: new Date().toISOString(),
  });
  assert.equal(dayOneFinalError, null, dayOneFinalError?.message);
  assert.equal(dayOneFinal[0].ats_picks_graded, 4);

  const { data: chaserDayOnePicks } = await admin
    .from("picks")
    .select("result")
    .eq("player_id", chaserId)
    .in("game_id", playoffGames.slice(0, 2).map((game) => game.id));
  assert.deepEqual(chaserDayOnePicks.map((pick) => pick.result).sort(), ["loss", "loss"], "every game on an eligible day remains official");

  const { error: secondSnapshotError } = await admin.rpc("snapshot_playoff_day_eligibility", {
    target_scoring_period_id: playoffPeriod.id,
    evaluated_at: new Date().toISOString(),
  });
  assert.equal(secondSnapshotError, null, secondSnapshotError?.message);
  const { data: latestEligibility, error: latestEligibilityError } = await admin
    .from("playoff_day_eligibility")
    .select("player_id, is_eligible, game_day")
    .eq("scoring_period_id", playoffPeriod.id)
    .in("player_id", [leaderId, chaserId])
    .order("game_day", { ascending: false });
  assert.equal(latestEligibilityError, null, latestEligibilityError?.message);
  const latestByPlayer = new Map(latestEligibility.map((row) => [row.player_id, row]));
  assert.equal(latestByPlayer.get(leaderId).is_eligible, true);
  assert.equal(latestByPlayer.get(chaserId).is_eligible, false, "a player unable to tie at the next day start is eliminated");

  const { data: chaserVoidedPick } = await admin
    .from("picks")
    .select("result")
    .eq("player_id", chaserId)
    .eq("game_id", playoffGames[2].id)
    .single();
  assert.equal(chaserVoidedPick.result, "void", "future playoff picks are voided once the player is out at day start");

  const { error: hidePrivatePicksError, data: anonymousPicks } = await publicClient
    .from("picks")
    .select("id")
    .in("player_id", [leaderId, chaserId]);
  assert.ok(hidePrivatePicksError || anonymousPicks.length === 0, "the public key must not expose private pick rows");

  const { error: startFinalGameError } = await admin
    .from("games")
    .update({ kickoff_at: iso(-60 * 1000), line_lock_at: iso(-2 * 60 * 1000) })
    .eq("id", playoffGames[2].id);
  assert.equal(startFinalGameError, null, startFinalGameError?.message);
  const { error: finalGameError } = await admin.rpc("finalize_games_atomically", {
    final_games: [{ game_id: playoffGames[2].id, away_score: 20, home_score: 13 }],
    accepted_at: new Date().toISOString(),
  });
  assert.equal(finalGameError, null, finalGameError?.message);

  const { error: finalHandoffError } = await admin.rpc("complete_scoring_period_atomically", {
    target_scoring_period_id: playoffPeriod.id,
    next_scoring_period_id: null,
    rollover_at: new Date().toISOString(),
  });
  assert.equal(finalHandoffError, null, finalHandoffError?.message);

  const { data: closedSeason } = await admin.from("seasons").select("state").eq("id", season.id).single();
  assert.equal(closedSeason.state, "complete", "the final settled playoff period must close the season automatically");

  const { data: championship, error: championshipError } = await admin
    .from("pool_championships")
    .select("season_year, pool, player_id")
    .eq("season_year", seasonYear)
    .eq("pool", "pickem")
    .single();
  assert.equal(championshipError, null, championshipError?.message);
  assert.deepEqual(championship, { season_year: seasonYear, pool: "pickem", player_id: leaderId });

  const rolloverAt = `${seasonYear + 1}-08-01T12:00:00.000Z`;
  const { data: rollover, error: rolloverError } = await admin.rpc("ensure_annual_season_rollover", { evaluated_at: rolloverAt });
  assert.equal(rolloverError, null, rolloverError?.message);
  assert.equal(rollover[0].created, true);
  const nextSeasonId = rollover[0].season_id;

  const { data: nextPeriods, error: nextPeriodsError } = await admin
    .from("scoring_periods")
    .select("display_name, period_type, max_picks, status, starts_at, ends_at")
    .eq("season_id", nextSeasonId)
    .order("display_order");
  assert.equal(nextPeriodsError, null, nextPeriodsError?.message);
  assert.equal(nextPeriods.length, 2);
  assert.ok(nextPeriods.every((period) => period.status === "upcoming" && period.starts_at === null && period.ends_at === null));

  const { count: oldPickCount } = await admin
    .from("picks")
    .select("id", { count: "exact", head: true })
    .in("player_id", [leaderId, chaserId]);
  assert.equal(oldPickCount, 12, "the completed season's individual records remain available");
  const { count: copiedPickCount } = await admin
    .from("picks")
    .select("id, scoring_periods!inner(season_id)", { count: "exact", head: true })
    .eq("scoring_periods.season_id", nextSeasonId);
  assert.equal(copiedPickCount, 0, "the new season receives configuration only, never old picks");
});
