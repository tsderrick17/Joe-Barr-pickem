import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig } from "./test-supabase.mjs";
import { SEASON_PHASE_SCENARIOS, atYear } from "../helpers/season-phase-scenarios.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

async function createSeason(admin, year, periods) {
  const { data: season, error } = await admin.from("seasons").insert({ year, state: "preseason" }).select("id").single();
  assert.equal(error, null, error?.message);
  const { error: periodError } = await admin.from("scoring_periods").insert([
    { season_id: season.id, display_name: "Week 1", period_type: "regular", max_picks: 2, display_order: 1, status: periods.regular },
    { season_id: season.id, display_name: "Super Bowl", period_type: "playoff", max_picks: 1, display_order: 22, status: periods.superBowl },
  ]);
  assert.equal(periodError, null, periodError?.message);
  return season.id;
}

async function clear(admin, years) {
  await admin.from("bowl_pool_seasons").delete().in("season_year", years);
  await admin.from("season_turnover_runs").delete().in("target_year", years);
  await admin.from("seasons").delete().in("year", years);
}

test("the database season phase and Bowl window match the shared scenarios", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  // Far enough ahead that this proof cannot collide with a real or another test's season.
  const year = 6000 + Math.floor(Math.random() * 1000);
  try {
    for (const scenario of SEASON_PHASE_SCENARIOS) {
      await clear(admin, [year, year + 1]);
      if (scenario.season) await createSeason(admin, year, scenario.season);
      else await createSeason(admin, year, { regular: "complete", superBowl: "complete" });
      if (scenario.nextSeason) await createSeason(admin, year + 1, scenario.nextSeason);
      await admin.from("bowl_pool_seasons").insert({
        season_year: scenario.nextSeason !== undefined ? year + 1 : year,
        status: scenario.bowlComplete ? "complete" : "scheduled",
        player_visible_at: `${year}-12-07T08:00:00Z`,
      });
      const at = atYear(scenario.at, year);
      const phase = await admin.rpc("season_phase", { evaluated_at: at });
      assert.equal(phase.error, null, phase.error?.message);
      assert.equal(phase.data, scenario.phase, scenario.name);
      const bowl = await admin.rpc("bowl_window_open", { evaluated_at: at });
      assert.equal(bowl.error, null, bowl.error?.message);
      assert.equal(bowl.data, scenario.bowlOpen, `${scenario.name} (Bowl window)`);
    }
  } finally {
    await clear(admin, [year, year + 1]);
  }
});

test("on August 1 the new season opens by itself: the phase flips at midnight Eastern and every active player carries over", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const year = 7000 + Math.floor(Math.random() * 1000);
  try {
    await createSeason(admin, year, { regular: "complete", superBowl: "complete" });
    const before = await admin.rpc("season_phase", { evaluated_at: `${year + 1}-08-01T03:59:59Z` });
    const at = await admin.rpc("season_phase", { evaluated_at: `${year + 1}-08-01T04:00:00Z` });
    assert.equal(before.data, "off_season", "July 31, 11:59:59 PM Eastern is still the off-season");
    assert.equal(at.data, "in_season", "August 1, 12:00:00 AM Eastern is the new season, before anything has run");

    const evaluatedAt = `${year + 1}-08-01T12:15:00Z`;
    const rollover = await admin.rpc("ensure_annual_season_rollover", { evaluated_at: evaluatedAt });
    assert.equal(rollover.error, null, rollover.error?.message);
    assert.equal(rollover.data[0].season_year, year + 1);
    assert.equal(rollover.data[0].created, true);

    const turnover = await admin.rpc("perform_annual_season_turnover", { evaluated_at: evaluatedAt });
    assert.equal(turnover.error, null, turnover.error?.message);
    assert.equal(turnover.data.status, "completed", JSON.stringify(turnover.data.blockers));

    const { count: activePlayers } = await admin.from("players").select("id", { count: "exact", head: true }).eq("active", true);
    const { count: entries } = await admin.from("survivor_entries").select("id", { count: "exact", head: true }).eq("season_id", rollover.data[0].season_id);
    assert.equal(entries, activePlayers, "every active player has a Survivor entry in the new season");

    const after = await admin.rpc("season_phase", { evaluated_at: evaluatedAt });
    assert.equal(after.data, "in_season");
    const bowl = await admin.rpc("bowl_window_open", { evaluated_at: evaluatedAt });
    assert.equal(bowl.data, false, "the Bowl Pool stays closed until December");
  } finally {
    await clear(admin, [year, year + 1]);
  }
});
