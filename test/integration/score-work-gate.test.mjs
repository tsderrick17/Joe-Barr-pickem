import assert from "node:assert/strict";
import test from "node:test";
import { FIRST_SCORE_CHECK_DELAY_MINUTES } from "../../src/lib/score-window.js";
import { createIsolatedClients, isolatedTestConfig, testToken } from "./test-supabase.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

// score_work_is_due, run for real. It is evaluated at a moment before any game kicked off (January 2000), so no final
// can be due; the dispatch-state rows this test writes make it true: a wake-up time the worker asked for, and the
// hourly safety run.
const evaluatedAt = "2000-01-01T12:00:00.000Z";
const minutesBefore = (minutes) => new Date(Date.parse(evaluatedAt) - minutes * 60_000).toISOString();

test("the score gate wakes the worker at the time it asked for, and at least once an hour", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const state = (row) => admin.from("automation_dispatch_state").upsert({ job_name: "scores", ...row }, { onConflict: "job_name" });
  const due = async () => {
    const { data, error } = await admin.rpc("score_work_is_due", { evaluated_at: evaluatedAt });
    assert.equal(error, null, error?.message);
    assert.equal(typeof data, "boolean");
    return data;
  };
  const { data: before } = await admin.from("automation_dispatch_state").select("*").eq("job_name", "scores").maybeSingle();
  try {
    assert.equal((await state({ last_dispatched_at: minutesBefore(10), next_due_at: minutesBefore(1) })).error, null);
    assert.equal(await due(), true, "a wake-up time that has come");

    assert.equal((await state({ last_dispatched_at: minutesBefore(120), next_due_at: null })).error, null);
    assert.equal(await due(), true, "no call for two hours: the safety run");
  } finally {
    if (before) await admin.from("automation_dispatch_state").upsert(before, { onConflict: "job_name" });
    else await admin.from("automation_dispatch_state").delete().eq("job_name", "scores");
  }
});

test("the score gate calls a game due exactly when the JavaScript rules say, and honours its retry timer to the second", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  // A game in January 2000 and a gate moment shortly after it, so nothing else in the database can be due. The period starts later that day
  // (same pool week), so "a week is waiting to open" is false too.
  const kickoff = Date.parse("2000-01-01T09:00:00.000Z");
  const firstCheck = kickoff + FIRST_SCORE_CHECK_DELAY_MINUTES * 60_000;
  const iso = (ms) => new Date(ms).toISOString();
  const due = async (atMs) => {
    const { data, error } = await admin.rpc("score_work_is_due", { evaluated_at: iso(atMs) });
    assert.equal(error, null, error?.message);
    return data;
  };
  let seasonId;
  let teamIds = [];
  const { data: before } = await admin.from("automation_dispatch_state").select("*").eq("job_name", "scores").maybeSingle();

  try {
    // The hourly safety run is not what is being tested: pretend the worker was called a few minutes ago.
    const dispatch = await admin.from("automation_dispatch_state").upsert({ job_name: "scores", last_dispatched_at: iso(firstCheck - 10 * 60_000), next_due_at: null }, { onConflict: "job_name" });
    assert.equal(dispatch.error, null, dispatch.error?.message);

    const { data: season, error: seasonError } = await admin.from("seasons").insert({ year: 3000 + Math.floor(Math.random() * 300), state: "preseason" }).select("id").single();
    assert.equal(seasonError, null, seasonError?.message);
    seasonId = season.id;
    const { data: period, error: periodError } = await admin.from("scoring_periods").insert({ season_id: seasonId, display_name: "Gate week", period_type: "regular", max_picks: 2, status: "upcoming", display_order: 1, starts_at: "2000-01-01T20:00:00.000Z" }).select("id").single();
    assert.equal(periodError, null, periodError?.message);
    const { data: teams, error: teamsError } = await admin.from("teams").insert([
      { abbreviation: `GA${token.slice(-4)}`.slice(0, 4), city: "Gate", mascot: "Away", full_name: `Gate ${token} Away` },
      { abbreviation: `GH${token.slice(-4)}`.slice(0, 4), city: "Gate", mascot: "Home", full_name: `Gate ${token} Home` },
    ]).select("id");
    assert.equal(teamsError, null, teamsError?.message);
    teamIds = teams.map((team) => team.id);
    const { data: game, error: gameError } = await admin.from("games").insert({ external_game_id: token, scoring_period_id: period.id, away_team_id: teamIds[0], home_team_id: teamIds[1], kickoff_at: iso(kickoff), line_lock_at: iso(kickoff) }).select("id").single();
    assert.equal(gameError, null, gameError?.message);

    assert.equal(await due(firstCheck - 1000), false, "one second before the first check is due");
    assert.equal(await due(firstCheck), true, "the first check is due at kickoff plus FIRST_SCORE_CHECK_DELAY_MINUTES");

    const timer = (nextCheckAt) => admin.from("score_check_backoff").upsert({ game_id: game.id, attempts: 1, last_checked_at: iso(firstCheck), next_check_at: iso(nextCheckAt) }, { onConflict: "game_id" });
    const at = firstCheck + 30 * 60_000;
    assert.equal((await timer(at + 1000)).error, null);
    assert.equal(await due(at), false, "a retry timer that runs one second past the gate moment keeps the game waiting");
    assert.equal((await timer(at)).error, null);
    assert.equal(await due(at), true, "a retry timer that ends exactly at the gate moment lets the game through");
  } finally {
    if (before) await admin.from("automation_dispatch_state").upsert(before, { onConflict: "job_name" });
    else await admin.from("automation_dispatch_state").delete().eq("job_name", "scores");
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
