import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig, testToken } from "./test-supabase.mjs";

const config = isolatedTestConfig();

test("activate_scoring_period_atomically opens only the right period, once", { skip: !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests." }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  let seasonId;
  let teamIds = [];

  try {
    const { data: season, error: seasonError } = await admin.from("seasons").insert({ year: 3000 + Math.floor(Math.random() * 1000), state: "preseason" }).select("id").single();
    assert.equal(seasonError, null, seasonError?.message);
    seasonId = season.id;

    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: periods, error: periodsError } = await admin.from("scoring_periods").insert([
      { season_id: seasonId, display_name: "Activation week 1", period_type: "regular", max_picks: 2, status: "upcoming", display_order: 1, starts_at: past },
      { season_id: seasonId, display_name: "Activation week 2", period_type: "regular", max_picks: 2, status: "upcoming", display_order: 2, starts_at: past },
    ]).select("id, display_order").order("display_order");
    assert.equal(periodsError, null, periodsError?.message);
    const [first, second] = periods;

    const activate = (id) => admin.rpc("activate_scoring_period_atomically", { target_scoring_period_id: id });

    const skipped = await activate(second.id);
    assert.equal(skipped.error, null, skipped.error?.message);
    assert.equal(skipped.data[0].activated, false);
    assert.match(skipped.data[0].blocked_reason, /earlier scoring period/);

    const empty = await activate(first.id);
    assert.equal(empty.data[0].activated, false);
    assert.match(empty.data[0].blocked_reason, /imported schedule/);

    const { data: teams, error: teamsError } = await admin.from("teams").insert([
      { abbreviation: `PA${token.slice(-4)}`.slice(0, 4), city: "Activation", mascot: "Away", full_name: `Activation ${token} Away` },
      { abbreviation: `PH${token.slice(-4)}`.slice(0, 4), city: "Activation", mascot: "Home", full_name: `Activation ${token} Home` },
    ]).select("id");
    assert.equal(teamsError, null, teamsError?.message);
    teamIds = teams.map((team) => team.id);
    const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: gameError } = await admin.from("games").insert({ external_game_id: token, scoring_period_id: first.id, away_team_id: teamIds[0], home_team_id: teamIds[1], kickoff_at: kickoff, line_lock_at: kickoff });
    assert.equal(gameError, null, gameError?.message);

    const opened = await activate(first.id);
    assert.equal(opened.error, null, opened.error?.message);
    assert.equal(opened.data[0].activated, true);

    const again = await activate(first.id);
    assert.equal(again.data[0].activated, false);
    const blockedByActive = await activate(second.id);
    assert.equal(blockedByActive.data[0].activated, false);
  } finally {
    if (seasonId) {
      const { data: rows } = await admin.from("scoring_periods").select("id").eq("season_id", seasonId);
      const ids = (rows ?? []).map((row) => row.id);
      if (ids.length) await admin.from("games").delete().in("scoring_period_id", ids);
      await admin.from("scoring_periods").delete().eq("season_id", seasonId);
      await admin.from("seasons").delete().eq("id", seasonId);
    }
    if (teamIds.length) await admin.from("teams").delete().in("id", teamIds);
  }
});
