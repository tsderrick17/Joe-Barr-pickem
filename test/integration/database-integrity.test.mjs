import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedClients,
  isolatedTestConfig,
  testToken,
} from "./test-supabase.mjs";

const config = isolatedTestConfig();

test("isolated database enforces atomic ATS and Survivor grading", { skip: !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests." }, async () => {
  const { admin, publicClient } = createIsolatedClients(config);
  const token = testToken();
  const name = `Integration ${token}`;
  let seasonId;
  let playerId;
  let teamIds = [];

  try {
    const { data: season, error: seasonError } = await admin
      .from("seasons")
      .insert({ year: 3000 + Math.floor(Math.random() * 1000), state: "regular_season" })
      .select("id")
      .single();
    assert.equal(seasonError, null, seasonError?.message);
    seasonId = season.id;

    const { data: period, error: periodError } = await admin
      .from("scoring_periods")
      .insert({ season_id: seasonId, display_name: "Integration week", period_type: "regular", max_picks: 2, status: "active", display_order: 1 })
      .select("id")
      .single();
    assert.equal(periodError, null, periodError?.message);

    const { data: teams, error: teamsError } = await admin
      .from("teams")
      .insert([
        { abbreviation: `IA${token.slice(-4)}`.slice(0, 4), city: "Integration", mascot: "Away", full_name: `${name} Away` },
        { abbreviation: `IH${token.slice(-4)}`.slice(0, 4), city: "Integration", mascot: "Home", full_name: `${name} Home` },
      ])
      .select("id");
    assert.equal(teamsError, null, teamsError?.message);
    teamIds = teams.map((team) => team.id);

    const kickoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: game, error: gameError } = await admin
      .from("games")
      .insert({
        external_game_id: token,
        scoring_period_id: period.id,
        away_team_id: teamIds[0],
        home_team_id: teamIds[1],
        kickoff_at: kickoff,
        line_lock_at: kickoff,
      })
      .select("id")
      .single();
    assert.equal(gameError, null, gameError?.message);

    const { error: lineError } = await admin.from("game_lines").insert({
      game_id: game.id,
      favorite_team_id: teamIds[0],
      locked_spread: 2.5,
      source: "integration-test",
      source_captured_at: new Date().toISOString(),
    });
    assert.equal(lineError, null, lineError?.message);

    const { data: player, error: playerError } = await admin
      .from("players")
      .insert({ first_name: name })
      .select("id")
      .single();
    assert.equal(playerError, null, playerError?.message);
    playerId = player.id;

    const { error: entryError } = await admin.rpc("ensure_survivor_entries", { target_season_id: seasonId });
    assert.equal(entryError, null, entryError?.message);
    const { data: entry, error: entryLoadError } = await admin
      .from("survivor_entries")
      .select("id")
      .eq("player_id", playerId)
      .eq("season_id", seasonId)
      .single();
    assert.equal(entryLoadError, null, entryLoadError?.message);

    const replacements = [{ game_id: game.id, selected_team_id: teamIds[0] }];
    const [firstSave, secondSave] = await Promise.all([
      admin.rpc("replace_unlocked_picks", { target_player_id: playerId, target_scoring_period_id: period.id, replacement_picks: replacements }),
      admin.rpc("replace_unlocked_picks", { target_player_id: playerId, target_scoring_period_id: period.id, replacement_picks: replacements }),
    ]);
    assert.equal(firstSave.error, null, firstSave.error?.message);
    assert.equal(secondSave.error, null, secondSave.error?.message);

    const { error: survivorSaveError } = await admin.rpc("replace_unlocked_survivor_pick", {
      target_survivor_entry_id: entry.id,
      target_scoring_period_id: period.id,
      replacement_pick: replacements[0],
    });
    assert.equal(survivorSaveError, null, survivorSaveError?.message);

    const { data: picks, error: pickLoadError } = await admin
      .from("picks")
      .select("id")
      .eq("player_id", playerId)
      .eq("scoring_period_id", period.id);
    assert.equal(pickLoadError, null, pickLoadError?.message);
    assert.equal(picks.length, 1, "concurrent ATS saves must leave one current pick");

    const { data: survivorPicks, error: survivorPickLoadError } = await admin
      .from("survivor_picks")
      .select("id")
      .eq("survivor_entry_id", entry.id)
      .eq("scoring_period_id", period.id);
    assert.equal(survivorPickLoadError, null, survivorPickLoadError?.message);
    assert.equal(survivorPicks.length, 1);

    const { error: unprivilegedFinalization } = await publicClient.rpc("finalize_games_atomically", {
      final_games: [],
    });
    assert.ok(unprivilegedFinalization, "the public key must not finalize games");

    const { error: pastKickoffError } = await admin
      .from("games")
      .update({ kickoff_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("id", game.id);
    assert.equal(pastKickoffError, null, pastKickoffError?.message);

    const { data: finalization, error: finalizationError } = await admin.rpc("finalize_games_atomically", {
      final_games: [{ game_id: game.id, away_score: 24, home_score: 17 }],
    });
    assert.equal(finalizationError, null, finalizationError?.message);
    assert.equal(finalization[0].ats_picks_graded, 1);
    assert.equal(finalization[0].survivor_picks_graded, 1);

    const { data: gradedPick } = await admin.from("picks").select("result").eq("id", picks[0].id).single();
    assert.equal(gradedPick.result, "win");
    const { data: gradedEntry } = await admin.from("survivor_entries").select("status").eq("id", entry.id).single();
    assert.equal(gradedEntry.status, "active");
  } finally {
    if (seasonId) await admin.from("seasons").delete().eq("id", seasonId);
    if (playerId) await admin.from("players").delete().eq("id", playerId);
    if (teamIds.length) await admin.from("teams").delete().in("id", teamIds);
  }
});
