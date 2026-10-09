import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedClients,
  isolatedTestConfig,
  testToken,
} from "./test-supabase.mjs";

const config = isolatedTestConfig();

test("lock_official_lines_atomically saves lines, history, and audit together or not at all", { skip: !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests." }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  let seasonId;
  let teamIds = [];

  try {
    const { data: season, error: seasonError } = await admin
      .from("seasons")
      .insert({ year: 3300 + Math.floor(Math.random() * 300), state: "regular_season" })
      .select("id")
      .single();
    assert.equal(seasonError, null, seasonError?.message);
    seasonId = season.id;

    const { data: period, error: periodError } = await admin
      .from("scoring_periods")
      .insert({ season_id: seasonId, display_name: "Line lock week", period_type: "regular", max_picks: 2, status: "active", display_order: 1 })
      .select("id")
      .single();
    assert.equal(periodError, null, periodError?.message);

    const { data: teams, error: teamsError } = await admin
      .from("teams")
      .insert([
        { abbreviation: `LA${token.slice(-4)}`.slice(0, 4), city: "Line", mascot: "Away", full_name: `Line ${token} Away` },
        { abbreviation: `LH${token.slice(-4)}`.slice(0, 4), city: "Line", mascot: "Home", full_name: `Line ${token} Home` },
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
        line_lock_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    assert.equal(gameError, null, gameError?.message);

    const capturedAt = new Date().toISOString();
    const decision = (gameId) => ({
      game_id: gameId,
      favorite_team_id: teamIds[0],
      spread: 3.5,
      source: "integration-test",
      source_captured_at: capturedAt,
      used_fallback: false,
      pick_em: false,
      record_history: true,
    });

    // A failing second decision (unknown game) must undo the first one completely.
    const failed = await admin.rpc("lock_official_lines_atomically", {
      decisions: [decision(game.id), decision("00000000-0000-4000-8000-000000000000")],
      locked_at: capturedAt,
    });
    assert.ok(failed.error, "an invalid decision must fail the whole call");
    const afterFailure = await admin.from("game_lines").select("game_id").eq("game_id", game.id);
    assert.equal(afterFailure.data.length, 0, "no line may be saved by a failed call");
    const historyAfterFailure = await admin.from("spread_history").select("id").eq("game_id", game.id);
    assert.equal(historyAfterFailure.data.length, 0, "no history may be saved by a failed call");

    const saved = await admin.rpc("lock_official_lines_atomically", {
      decisions: [decision(game.id)],
      locked_at: capturedAt,
    });
    assert.equal(saved.error, null, saved.error?.message);
    assert.equal(saved.data, 1);
    const line = await admin.from("game_lines").select("locked_spread, manual_override").eq("game_id", game.id).single();
    assert.equal(Number(line.data.locked_spread), 3.5);
    assert.equal(line.data.manual_override, false);
    const audit = await admin.from("audit_logs").select("id").eq("entity_id", game.id).eq("action", "official_line_locked");
    assert.equal(audit.data.length, 1);

    // Retrying is safe: nothing changes and no duplicate audit entry appears.
    const retry = await admin.rpc("lock_official_lines_atomically", {
      decisions: [decision(game.id)],
      locked_at: capturedAt,
    });
    assert.equal(retry.error, null, retry.error?.message);
    assert.equal(retry.data, 0);
    const auditAfterRetry = await admin.from("audit_logs").select("id").eq("entity_id", game.id).eq("action", "official_line_locked");
    assert.equal(auditAfterRetry.data.length, 1);

    const notArray = await admin.rpc("lock_official_lines_atomically", { decisions: { game_id: game.id }, locked_at: capturedAt });
    assert.ok(notArray.error, "decisions must be an array");
  } finally {
    if (seasonId) {
      const { data: periodRows } = await admin.from("scoring_periods").select("id").eq("season_id", seasonId);
      const periodIds = (periodRows ?? []).map((row) => row.id);
      if (periodIds.length) await admin.from("games").delete().in("scoring_period_id", periodIds);
      await admin.from("scoring_periods").delete().eq("season_id", seasonId);
      await admin.from("seasons").delete().eq("id", seasonId);
    }
    if (teamIds.length) await admin.from("teams").delete().in("id", teamIds);
  }
});
