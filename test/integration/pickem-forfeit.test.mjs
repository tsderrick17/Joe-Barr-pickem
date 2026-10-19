import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedClients, isolatedTestConfig, testToken } from "./test-supabase.mjs";

const config = isolatedTestConfig();
const skip = !config && "Set the isolated PICKEM_TEST_SUPABASE_* variables to run database integration tests.";

/** A season in the playoffs: one Wild Card round with two games, one about to start and one a day away. */
async function playoffSeason(admin, token, { roundStatus = "active" } = {}) {
  const year = 8000 + Math.floor(Math.random() * 900);
  const { data: season, error: seasonError } = await admin.from("seasons").insert({ year, state: "playoffs" }).select("id").single();
  assert.equal(seasonError, null, seasonError?.message);
  const { data: period, error: periodError } = await admin
    .from("scoring_periods")
    .insert({ season_id: season.id, display_name: "Wild Card", period_type: "playoff", max_picks: 2, status: roundStatus, display_order: 20 })
    .select("id")
    .single();
  assert.equal(periodError, null, periodError?.message);
  const { data: teams, error: teamsError } = await admin
    .from("teams")
    .insert([0, 1, 2, 3].map((index) => ({ abbreviation: `F${index}${token.slice(-3)}`.slice(0, 4), city: "Forfeit", mascot: `Team ${index}`, full_name: `Forfeit ${token} ${index}` })))
    .select("id");
  assert.equal(teamsError, null, teamsError?.message);
  const teamIds = teams.map((team) => team.id);
  const games = [];
  for (const [index, hours] of [[0, 1], [1, 24]]) {
    const kickoff = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { data: game, error } = await admin
      .from("games")
      .insert({ external_game_id: `${token}-${index}`, scoring_period_id: period.id, away_team_id: teamIds[index * 2], home_team_id: teamIds[index * 2 + 1], kickoff_at: kickoff, line_lock_at: kickoff })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    const { error: lineError } = await admin.from("game_lines").insert({ game_id: game.id, favorite_team_id: teamIds[index * 2], locked_spread: 3.5, source: "integration-test", source_captured_at: new Date().toISOString() });
    assert.equal(lineError, null, lineError?.message);
    games.push({ id: game.id, away: teamIds[index * 2], home: teamIds[index * 2 + 1] });
  }
  return { seasonId: season.id, period, teamIds, games };
}

async function newPlayer(admin, name, extra = {}) {
  const { data, error } = await admin.from("players").insert({ first_name: name, ...extra }).select("id").single();
  assert.equal(error, null, error?.message);
  return data.id;
}

async function savePicks(admin, playerId, periodId, picks) {
  return admin.rpc("replace_unlocked_picks", { target_player_id: playerId, target_scoring_period_id: periodId, replacement_picks: picks });
}

async function resultsFor(admin, playerId, periodId) {
  const { data, error } = await admin.from("picks").select("game_id, result").eq("player_id", playerId).eq("scoring_period_id", periodId);
  assert.equal(error, null, error?.message);
  return Object.fromEntries(data.map((row) => [row.game_id, row.result]));
}

test("forfeiting voids only the picks on games that have not started, locks the player out, and is idempotent", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  const playerIds = [];
  let setup;
  try {
    setup = await playoffSeason(admin, token);
    const { period, games } = setup;
    const forfeiter = await newPlayer(admin, `Forfeit ${token}`);
    const bystander = await newPlayer(admin, `Bystander ${token}`);
    playerIds.push(forfeiter, bystander);

    for (const playerId of [forfeiter, bystander]) {
      const { error } = await savePicks(admin, playerId, period.id, games.map((game) => ({ game_id: game.id, selected_team_id: game.away })));
      assert.equal(error, null, error?.message);
    }
    // The first game kicks off; the second is still a day away.
    const { error: kickoffError } = await admin.from("games").update({ kickoff_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }).eq("id", games[0].id);
    assert.equal(kickoffError, null, kickoffError?.message);

    const first = await admin.rpc("forfeit_pickem_season", { target_player_id: forfeiter });
    assert.equal(first.error, null, first.error?.message);
    assert.deepEqual(
      { season: first.data[0].forfeited_season_id, voided: first.data[0].voided_picks, again: first.data[0].was_already_forfeited },
      { season: setup.seasonId, voided: 1, again: false },
    );

    // The started game's pick stays and will grade; the unstarted one is out. Nobody else is touched.
    assert.deepEqual(await resultsFor(admin, forfeiter, period.id), { [games[0].id]: "pending", [games[1].id]: "void" });
    assert.deepEqual(await resultsFor(admin, bystander, period.id), { [games[0].id]: "pending", [games[1].id]: "pending" });

    // Done twice, it is still one forfeit and voids nothing more.
    const second = await admin.rpc("forfeit_pickem_season", { target_player_id: forfeiter });
    assert.equal(second.error, null, second.error?.message);
    assert.deepEqual({ voided: second.data[0].voided_picks, again: second.data[0].was_already_forfeited }, { voided: 0, again: true });
    const { data: forfeits } = await admin.from("pickem_forfeits").select("id, picks_voided").eq("player_id", forfeiter).is("reversed_at", null);
    assert.equal(forfeits.length, 1);
    assert.equal(forfeits[0].picks_voided, 1);

    // The database refuses any further save, whatever the route does.
    const blocked = await savePicks(admin, forfeiter, period.id, [{ game_id: games[1].id, selected_team_id: games[1].home }]);
    assert.match(blocked.error?.message ?? "", /forfeited/);
    assert.deepEqual(await resultsFor(admin, forfeiter, period.id), { [games[0].id]: "pending", [games[1].id]: "void" });

    // Everyone else can still save.
    const stillOpen = await savePicks(admin, bystander, period.id, [{ game_id: games[1].id, selected_team_id: games[1].home }]);
    assert.equal(stillOpen.error, null, stillOpen.error?.message);

    const { data: audit } = await admin.from("audit_logs").select("action").eq("actor_player_id", forfeiter).in("action", ["pickem_forfeited", "ats_pick_voided"]);
    assert.deepEqual(audit.map((row) => row.action).sort(), ["ats_pick_voided", "pickem_forfeited"]);
  } finally {
    if (setup) await admin.from("seasons").delete().eq("id", setup.seasonId);
    if (playerIds.length) await admin.from("players").delete().in("id", playerIds);
    if (setup) await admin.from("teams").delete().in("id", setup.teamIds);
  }
});

test("a player cannot forfeit before the first playoff round is open for picks", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  let setup;
  let playerId;
  try {
    setup = await playoffSeason(admin, token, { roundStatus: "upcoming" });
    playerId = await newPlayer(admin, `Early ${token}`);
    // Other tests may leave an active playoff round behind; this asserts on the attempt for this season's player only if none is active.
    const { data: active } = await admin.from("scoring_periods").select("id").eq("period_type", "playoff").eq("status", "active");
    if (active?.length) return;
    const attempt = await admin.rpc("forfeit_pickem_season", { target_player_id: playerId });
    assert.match(attempt.error?.message ?? "", /Forfeiting opens/);
    const { data: forfeits } = await admin.from("pickem_forfeits").select("id").eq("player_id", playerId);
    assert.equal(forfeits.length, 0);
  } finally {
    if (setup) await admin.from("seasons").delete().eq("id", setup.seasonId);
    if (playerId) await admin.from("players").delete().eq("id", playerId);
    if (setup) await admin.from("teams").delete().in("id", setup.teamIds);
  }
});

test("only the Commissioner can reverse a forfeit, and the player can pick again afterwards", { skip }, async () => {
  const { admin } = createIsolatedClients(config);
  const token = testToken();
  const playerIds = [];
  let setup;
  try {
    setup = await playoffSeason(admin, token);
    const { period, games } = setup;
    const forfeiter = await newPlayer(admin, `Reverse ${token}`);
    const commissioner = await newPlayer(admin, `Commish ${token}`, { is_commissioner: true });
    const ordinary = await newPlayer(admin, `Ordinary ${token}`);
    playerIds.push(forfeiter, commissioner, ordinary);

    const forfeit = await admin.rpc("forfeit_pickem_season", { target_player_id: forfeiter });
    assert.equal(forfeit.error, null, forfeit.error?.message);

    const refused = await admin.rpc("reverse_pickem_forfeit", { target_player_id: forfeiter, acting_player_id: ordinary });
    assert.match(refused.error?.message ?? "", /Only the Commissioner/);
    const stillBlocked = await savePicks(admin, forfeiter, period.id, [{ game_id: games[1].id, selected_team_id: games[1].away }]);
    assert.match(stillBlocked.error?.message ?? "", /forfeited/);

    const reversed = await admin.rpc("reverse_pickem_forfeit", { target_player_id: forfeiter, acting_player_id: commissioner });
    assert.equal(reversed.error, null, reversed.error?.message);
    assert.equal(reversed.data, true);

    const again = await admin.rpc("reverse_pickem_forfeit", { target_player_id: forfeiter, acting_player_id: commissioner });
    assert.equal(again.error, null, again.error?.message);
    assert.equal(again.data, false, "there is nothing left to reverse");

    const saved = await savePicks(admin, forfeiter, period.id, [{ game_id: games[1].id, selected_team_id: games[1].away }]);
    assert.equal(saved.error, null, saved.error?.message);

    const { data: audit } = await admin.from("audit_logs").select("action").eq("actor_player_id", commissioner).eq("action", "pickem_forfeit_reversed");
    assert.equal(audit.length, 1);

    // Forfeiting again after a reversal starts a fresh forfeit.
    const second = await admin.rpc("forfeit_pickem_season", { target_player_id: forfeiter });
    assert.equal(second.error, null, second.error?.message);
    assert.equal(second.data[0].was_already_forfeited, false);
  } finally {
    if (setup) await admin.from("seasons").delete().eq("id", setup.seasonId);
    if (playerIds.length) await admin.from("players").delete().in("id", playerIds);
    if (setup) await admin.from("teams").delete().in("id", setup.teamIds);
  }
});

test("the forfeit table is closed to the public client", { skip }, async () => {
  const { publicClient } = createIsolatedClients(config);
  const read = await publicClient.from("pickem_forfeits").select("id").limit(1);
  assert.ok(read.error || (read.data ?? []).length === 0, "the public client reads nothing");
  const call = await publicClient.rpc("forfeit_pickem_season", { target_player_id: "00000000-0000-0000-0000-000000000000" });
  assert.ok(call.error, "the public client cannot call the forfeit function");
});
