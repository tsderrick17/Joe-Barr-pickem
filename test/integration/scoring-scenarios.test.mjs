import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig, testToken } from "./test-supabase.mjs";
import { SCORING_SCENARIOS } from "../helpers/scoring-scenarios.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

// The same scenarios as test/scoring-scenarios.test.mjs, graded by the database: finalize_games_atomically writes the
// ATS result of each pick and the Survivor status of each entry. Each scenario has its own scoring period, teams
// and player, so one Survivor loss never affects another scenario.
test("the database grades every shared scoring scenario exactly as the application rules do", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  const year = 4000 + Math.floor(Math.random() * 1000);
  let seasonId;
  const teamIds = [];
  const playerIds = [];

  try {
    const { data: season, error: seasonError } = await admin.from("seasons").insert({ year, state: "regular_season" }).select("id").single();
    assert.equal(seasonError, null, seasonError?.message);
    seasonId = season.id;

    const rows = [];
    for (const [index, scenario] of SCORING_SCENARIOS.entries()) {
      const label = `${token}${index}`;
      const { data: period, error: periodError } = await admin
        .from("scoring_periods")
        .insert({ season_id: seasonId, display_name: `Scenario ${index + 1}`, period_type: "regular", max_picks: 1, status: "active", display_order: index + 1 })
        .select("id")
        .single();
      assert.equal(periodError, null, periodError?.message);
      const { data: teams, error: teamsError } = await admin
        .from("teams")
        .insert([
          { abbreviation: `A${index.toString(36)}${token.slice(-2)}`.slice(0, 4), city: "Scen", mascot: "Away", full_name: `Scen ${label} Away` },
          { abbreviation: `H${index.toString(36)}${token.slice(-2)}`.slice(0, 4), city: "Scen", mascot: "Home", full_name: `Scen ${label} Home` },
        ])
        .select("id");
      assert.equal(teamsError, null, teamsError?.message);
      const [away, home] = teams.map((entry) => entry.id);
      teamIds.push(away, home);
      const side = { away, home };
      const { data: game, error: gameError } = await admin
        .from("games")
        .insert({ external_game_id: label, scoring_period_id: period.id, away_team_id: away, home_team_id: home, kickoff_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), line_lock_at: new Date().toISOString() })
        .select("id")
        .single();
      assert.equal(gameError, null, gameError?.message);
      if (scenario.favorite) {
        const { error: lineError } = await admin.from("game_lines").insert({
          game_id: game.id,
          favorite_team_id: side[scenario.favorite],
          locked_spread: scenario.spread,
          source: "integration-test",
          source_captured_at: new Date().toISOString(),
        });
        assert.equal(lineError, null, `${scenario.name}: ${lineError?.message}`);
      }
      const { data: player, error: playerError } = await admin.from("players").insert({ first_name: `Scen ${label}` }).select("id").single();
      assert.equal(playerError, null, playerError?.message);
      playerIds.push(player.id);
      rows.push({ scenario, period, game, player, side });
    }

    const { error: entryError } = await admin.rpc("ensure_survivor_entries", { target_season_id: seasonId });
    assert.equal(entryError, null, entryError?.message);

    for (const item of rows) {
      const { scenario, period, game, player, side } = item;
      const { error: pickError } = await admin.rpc("replace_unlocked_picks", {
        target_player_id: player.id,
        target_scoring_period_id: period.id,
        replacement_picks: [{ game_id: game.id, selected_team_id: side[scenario.ats] }],
      });
      assert.equal(pickError, null, `${scenario.name}: ${pickError?.message}`);
      const { data: entry } = await admin.from("survivor_entries").select("id").eq("player_id", player.id).eq("season_id", seasonId).single();
      const { error: survivorError } = await admin.rpc("replace_unlocked_survivor_pick", {
        target_survivor_entry_id: entry.id,
        target_scoring_period_id: period.id,
        replacement_pick: { game_id: game.id, selected_team_id: side[scenario.survivor] },
      });
      assert.equal(survivorError, null, `${scenario.name}: ${survivorError?.message}`);
      item.entry = entry;
    }

    // Every game kicks off and ends.
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    for (const { game } of rows) {
      const { error } = await admin.from("games").update({ kickoff_at: past }).eq("id", game.id);
      assert.equal(error, null, error?.message);
    }
    const { data: finalization, error: finalizationError } = await admin.rpc("finalize_games_atomically", {
      final_games: rows.map(({ scenario, game }) => ({ game_id: game.id, away_score: scenario.away, home_score: scenario.home })),
    });
    assert.equal(finalizationError, null, finalizationError?.message);
    assert.ok(finalization?.[0], "the finalization reports its counts");

    for (const { scenario, period, player, entry } of rows) {
      const { data: pick } = await admin.from("picks").select("result").eq("player_id", player.id).eq("scoring_period_id", period.id).single();
      assert.equal(pick.result, scenario.atsGrade, `ATS: ${scenario.name}`);
      const { data: survivorPick } = await admin.from("survivor_picks").select("result").eq("survivor_entry_id", entry.id).eq("scoring_period_id", period.id).single();
      assert.equal(survivorPick.result, scenario.survivorGrade, `Survivor: ${scenario.name}`);
      const { data: entryNow } = await admin.from("survivor_entries").select("status").eq("id", entry.id).single();
      assert.equal(entryNow.status, scenario.survivorGrade === "win" ? "active" : "eliminated", `Survivor entry: ${scenario.name}`);
    }
  } finally {
    if (seasonId) await admin.from("seasons").delete().eq("id", seasonId);
    if (playerIds.length) await admin.from("players").delete().in("id", playerIds);
    if (teamIds.length) await admin.from("teams").delete().in("id", teamIds);
  }
});
