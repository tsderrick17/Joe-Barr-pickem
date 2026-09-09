import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";

type Selection = { gameId: string; teamId: string };

async function currentPlayer(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!authorization?.startsWith("Bearer ") || !url || !key) return null;
  const authClient = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await authClient.auth.getUser(authorization.slice("Bearer ".length));
  if (!user) return null;
  const { data: player } = await supabaseAdmin.from("players").select("id, first_name, active, is_commissioner").eq("auth_user_id", user.id).maybeSingle();
  return player?.active ? player : null;
}

async function seasonAndGames() {
  const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").select("id, season_year, player_visible_at, first_kickoff_at, championship_game_id").eq("season_year", CURRENT_SEASON_YEAR).maybeSingle();
  if (seasonError || !season) return { season: null, games: [], error: seasonError ?? new Error("Bowl Pool season is not configured.") };
  const { data: games, error } = await supabaseAdmin.from("bowl_pool_games").select("id, provider_game_id, bowl_name, kickoff_at, line_lock_at, order_index, status, away_team_id, home_team_id, away_score, home_score, venue_city, venue_state, time_confirmed").eq("season_id", season.id).order("order_index");
  if (error) return { season, games: [], error };
  return { season, games: games ?? [], error: null };
}

export async function GET(request: NextRequest) {
  const player = await currentPlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in to view the Bowl Pool." }, { status: 401 });
  const context = await seasonAndGames();
  if (!context.season) return NextResponse.json({ error: "The Bowl Pool is not configured yet." }, { status: 503 });
  const now = new Date();
  if (!player.is_commissioner && now < new Date(bowlPoolLaunchAt(CURRENT_SEASON_YEAR))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const gameIds = context.games.map((game) => game.id);
  const teamIds = [...new Set(context.games.flatMap((game) => [game.away_team_id, game.home_team_id]))];
  const [{ data: teams }, { data: ownEntry }, { data: ownPicks }, { data: allEntries }, { data: allPicks }, { data: lines }, { data: automaticResults }] = await Promise.all([
    teamIds.length ? supabaseAdmin.from("bowl_pool_teams").select("id, display_name, short_name, abbreviation").in("id", teamIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("bowl_pool_entries").select("id, status, championship_total_guess, opted_in_at, opted_out_at").eq("season_id", context.season.id).eq("player_id", player.id).maybeSingle(),
    supabaseAdmin.from("bowl_pool_picks").select("id, game_id, selected_team_id, result").eq("entry_id", (await supabaseAdmin.from("bowl_pool_entries").select("id").eq("season_id", context.season.id).eq("player_id", player.id).maybeSingle()).data?.id ?? "00000000-0000-0000-0000-000000000000"),
    supabaseAdmin.from("bowl_pool_entries").select("id, player_id, status, championship_total_guess").eq("season_id", context.season.id),
    supabaseAdmin.from("bowl_pool_picks").select("entry_id, game_id, selected_team_id, result"),
    gameIds.length ? supabaseAdmin.from("bowl_pool_game_lines").select("game_id, favorite_team_id, locked_spread, locked_at").in("game_id", gameIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from("bowl_pool_game_results").select("entry_id, game_id, result"),
  ]);
  const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
  const lineByGameId = new Map((lines ?? []).map((line) => [line.game_id, line]));
  const seasonEntryIds = new Set((allEntries ?? []).map((entry) => entry.id));
  const seasonPicks = (allPicks ?? []).filter((pick) => seasonEntryIds.has(pick.entry_id) && gameIds.includes(pick.game_id));
  const seasonAutomaticResults = (automaticResults ?? []).filter((result) => seasonEntryIds.has(result.entry_id) && gameIds.includes(result.game_id));
  const activeEntryIds = new Set((allEntries ?? []).filter((entry) => entry.status === "active" || entry.status === "complete").map((entry) => entry.id));
  const publicPicks = seasonPicks.filter((pick) => {
    const game = context.games.find((candidate) => candidate.id === pick.game_id);
    return activeEntryIds.has(pick.entry_id) && game && new Date(game.kickoff_at) <= now;
  }).map((pick) => ({ ...pick, playerId: (allEntries ?? []).find((entry) => entry.id === pick.entry_id)?.player_id ?? null }));
  const privatePickMarkers = seasonPicks.filter((pick) => {
      const game = context.games.find((candidate) => candidate.id === pick.game_id);
      const entry = (allEntries ?? []).find((candidate) => candidate.id === pick.entry_id);
      return game && new Date(game.kickoff_at) > now && (player.is_commissioner || entry?.player_id === player.id);
    }).map((pick) => ({ playerId: (allEntries ?? []).find((entry) => entry.id === pick.entry_id)?.player_id ?? null, game_id: pick.game_id }));
  const playerIds = [...new Set((allEntries ?? []).map((entry) => entry.player_id))];
  const { data: players } = player.is_commissioner && now < new Date(bowlPoolLaunchAt(CURRENT_SEASON_YEAR))
    ? await supabaseAdmin.from("players").select("id, first_name").eq("active", true).order("first_name")
    : playerIds.length ? await supabaseAdmin.from("players").select("id, first_name").in("id", playerIds) : { data: [] };
  const playerNameById = new Map((players ?? []).map((row) => [row.id, row.first_name]));
  const [{ data: championships }, { data: currentChampionships }] = await Promise.all([
    supabaseAdmin.from("pool_championships").select("player_id, season_year").eq("pool", "bowl").order("season_year", { ascending: false }),
    supabaseAdmin.from("bowl_pool_championships").select("player_id").eq("season_id", context.season.id),
  ]);
  const trophiesByPlayerId = new Map<string, string[]>();
  const championshipCounts = new Map<number, number>();
  for (const championship of championships ?? []) championshipCounts.set(championship.season_year, (championshipCounts.get(championship.season_year) ?? 0) + 1);
  for (const championship of championships ?? []) {
    const titles = trophiesByPlayerId.get(championship.player_id) ?? [];
    titles.push(`'${String(championship.season_year).slice(-2)} Bowl Pool ${(championshipCounts.get(championship.season_year) ?? 0) > 1 ? "Co-Champion" : "Champion"}`);
    trophiesByPlayerId.set(championship.player_id, titles);
  }
  const standings = (allEntries ?? []).filter((entry) => entry.status === "active" || entry.status === "complete").map((entry) => ({
    playerId: entry.player_id,
    playerName: playerNameById.get(entry.player_id) ?? "Player",
    wins: (() => { const pickKeys = new Set(seasonPicks.filter((pick) => pick.entry_id === entry.id).map((pick) => `${pick.entry_id}:${pick.game_id}`)); return seasonPicks.filter((pick) => pick.entry_id === entry.id && pick.result === "win").length + seasonAutomaticResults.filter((result) => result.entry_id === entry.id && result.result === "win" && !pickKeys.has(`${result.entry_id}:${result.game_id}`)).length; })(),
    losses: (() => { const pickKeys = new Set(seasonPicks.filter((pick) => pick.entry_id === entry.id).map((pick) => `${pick.entry_id}:${pick.game_id}`)); return seasonPicks.filter((pick) => pick.entry_id === entry.id && pick.result === "loss").length + seasonAutomaticResults.filter((result) => result.entry_id === entry.id && result.result === "loss" && !pickKeys.has(`${result.entry_id}:${result.game_id}`)).length; })(),
    tiebreakerTotal: entry.championship_total_guess,
    trophies: trophiesByPlayerId.get(entry.player_id) ?? [],
  })).concat(player.is_commissioner && now < new Date(bowlPoolLaunchAt(CURRENT_SEASON_YEAR))
    ? (players ?? []).filter((candidate) => !(allEntries ?? []).some((entry) => entry.player_id === candidate.id)).map((candidate) => ({ playerId: candidate.id, playerName: candidate.first_name, wins: 0, losses: 0, tiebreakerTotal: null, trophies: trophiesByPlayerId.get(candidate.id) ?? [] }))
    : []).sort((a, b) => {
      const wins = b.wins - a.wins;
      if (wins) return wins;
      const finalGame = context.games.find((game) => game.id === context.season?.championship_game_id && game.status === "final");
      const finalTotal = finalGame && Number.isInteger(finalGame.away_score) && Number.isInteger(finalGame.home_score) ? finalGame.away_score! + finalGame.home_score! : null;
      if (finalTotal !== null && a.tiebreakerTotal !== null && b.tiebreakerTotal !== null) {
        const difference = Math.abs(a.tiebreakerTotal - finalTotal) - Math.abs(b.tiebreakerTotal - finalTotal);
        if (difference) return difference;
      }
      return a.losses - b.losses || String(a.playerId).localeCompare(String(b.playerId));
    });
  return NextResponse.json({
    season: { ...context.season, launchAt: bowlPoolLaunchAt(CURRENT_SEASON_YEAR) },
    isCommissioner: Boolean(player.is_commissioner),
    optedIn: ownEntry?.status === "active" || ownEntry?.status === "complete",
    entry: ownEntry ?? null,
    games: context.games.map((game) => ({ ...game, awayTeam: teamById.get(game.away_team_id) ? { ...teamById.get(game.away_team_id), full_name: teamById.get(game.away_team_id)!.display_name } : null, homeTeam: teamById.get(game.home_team_id) ? { ...teamById.get(game.home_team_id), full_name: teamById.get(game.home_team_id)!.display_name } : null, line: lineByGameId.get(game.id) ?? null })),
    ownPicks: ownPicks ?? [],
    publicPicks,
    automaticResults: seasonAutomaticResults.map((result) => ({ ...result, playerId: (allEntries ?? []).find((entry) => entry.id === result.entry_id)?.player_id ?? null })),
    privatePickMarkers,
    standings,
    championships: [
      ...(championships ?? []).map((championship) => ({ playerId: championship.player_id, seasonYear: championship.season_year, playerName: playerNameById.get(championship.player_id) ?? "Player" })),
      ...(currentChampionships ?? []).map((championship) => ({ playerId: championship.player_id, seasonYear: context.season!.season_year, playerName: playerNameById.get(championship.player_id) ?? "Player" })),
    ],
  });
}

export async function POST(request: NextRequest) {
  const player = await currentPlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in to save Bowl Pool selections." }, { status: 401 });
  let body: { optedIn?: unknown; selections?: Selection[]; championshipTotalGuess?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Your Bowl Pool submission was incomplete." }, { status: 400 }); }
  if (typeof body.optedIn !== "boolean" || !Array.isArray(body.selections)) return NextResponse.json({ error: "Opt-in status and selections are required." }, { status: 400 });
  const context = await seasonAndGames();
  if (!context.season) return NextResponse.json({ error: "The Bowl Pool is not configured yet." }, { status: 503 });
  const now = new Date();
  const firstKickoff = context.season.first_kickoff_at ? new Date(context.season.first_kickoff_at) : null;
  const { data: existing, error: existingError } = await supabaseAdmin.from("bowl_pool_entries").select("id, status, opted_in_at, championship_total_guess").eq("season_id", context.season.id).eq("player_id", player.id).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Your Bowl Pool entry could not be loaded." }, { status: 500 });
  const entryClosed = Boolean(firstKickoff && now >= firstKickoff && !player.is_commissioner);
  if (!body.optedIn) {
    if (entryClosed) return NextResponse.json({ error: "Bowl Pool opt-out closed at the first kickoff." }, { status: 409 });
    if (existing) {
      const { error } = await supabaseAdmin.from("bowl_pool_entries").update({ status: "withdrawn", opted_out_at: now.toISOString() }).eq("id", existing.id);
      if (error) return NextResponse.json({ error: "Your opt-out could not be saved." }, { status: 400 });
    }
    return NextResponse.json({ optedIn: false });
  }
  if (entryClosed && (!existing || existing.status !== "active")) return NextResponse.json({ error: "Bowl Pool entry closed at the first kickoff." }, { status: 409 });
  const unique = new Map<string, Selection>();
  for (const selection of body.selections) unique.set(selection.gameId, selection);
  const gameById = new Map(context.games.map((game) => [game.id, game]));
  for (const selection of unique.values()) {
    const game = gameById.get(selection.gameId);
    if (!game || new Date(game.kickoff_at) <= now || game.status !== "scheduled") return NextResponse.json({ error: "One of those games is no longer open for selections." }, { status: 400 });
    if (selection.teamId !== game.away_team_id && selection.teamId !== game.home_team_id) return NextResponse.json({ error: "A selection must be one of the teams in that game." }, { status: 400 });
  }
  const { data: entryId, error: saveError } = await supabaseAdmin.rpc("save_bowl_pool_submission", {
    target_player_id: player.id,
    target_season_id: context.season.id,
    target_opted_in: true,
    target_selections: [...unique.values()].map((selection) => ({ game_id: selection.gameId, team_id: selection.teamId })),
    target_tiebreaker: typeof body.championshipTotalGuess === "number" ? body.championshipTotalGuess : null,
    evaluated_at: now.toISOString(),
  });
  if (saveError || !entryId) return NextResponse.json({ error: saveError?.message ?? "Your Bowl Pool selections could not be saved." }, { status: 400 });
  return NextResponse.json({ optedIn: true, saved: unique.size });
}
