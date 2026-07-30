import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";

export const dynamic = "force-dynamic";

type Period = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
};

type PlayerAuthentication =
  | { ok: true; player: { id: string; active: boolean } }
  | { ok: false; error: string; status: 401 | 500 | 503 };

async function authenticatedPlayer(
  request: NextRequest,
): Promise<PlayerAuthentication> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !key) {
    return {
      ok: false,
      error: "The server is missing required configuration.",
      status: 500 as const,
    };
  }
  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      error: "You must be signed in as an active player.",
      status: 401 as const,
    };
  }

  const authClient = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) {
    const serviceUnavailable =
      userError ? (userError.status ?? 500) >= 500 : false;
    return {
      ok: false,
      error: serviceUnavailable
        ? "The sign-in service could not be reached."
        : "You must be signed in as an active player.",
      status: serviceUnavailable ? (503 as const) : (401 as const),
    };
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("id, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (playerError) {
    return {
      ok: false,
      error: "Your player profile could not be loaded.",
      status: 503 as const,
    };
  }
  if (!player?.active) {
    return {
      ok: false,
      error: "You must be signed in as an active player.",
      status: 401 as const,
    };
  }
  return { ok: true, player };
}

async function survivorContext(request: NextRequest) {
  const authentication = await authenticatedPlayer(request);
  if (!authentication.ok) {
    return {
      error: authentication.error,
      status: authentication.status,
    };
  }
  const { player } = authentication;

  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", CURRENT_SEASON_YEAR)
    .maybeSingle();
  if (seasonError) return { error: "The current season could not be loaded.", status: 503 as const };
  if (!season) return { error: `The ${CURRENT_SEASON_YEAR} season has not been set up.`, status: 404 as const };

  const ensured = await supabaseAdmin.rpc("ensure_survivor_entries", {
    target_season_id: season.id,
  });
  if (ensured.error) return { error: "Survivor entries could not be prepared.", status: 500 as const };

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, status")
    .eq("season_id", season.id)
    .order("display_order");
  if (periodsError) return { error: "The weekly schedule could not be loaded.", status: 503 as const };
  const period = selectDefaultScoringPeriod((periods ?? []) as Period[]);
  if (!period) return { error: "The weekly schedule could not be loaded.", status: 500 as const };

  const { data: entry, error: entryError } = await supabaseAdmin
    .from("survivor_entries")
    .select("id, status, eliminated_at")
    .eq("player_id", player.id)
    .eq("season_id", season.id)
    .maybeSingle();
  if (entryError) return { error: "Your Survivor entry could not be loaded.", status: 503 as const };
  if (!entry) return { error: "Your Survivor entry could not be loaded.", status: 500 as const };

  return { player, season, period, entry };
}

export async function GET(request: NextRequest) {
  try {
    await voidDisruptedPicks();
  } catch {
    // Read-only Survivor access remains available; submissions fail closed.
    console.error("Disrupted-game check failed while loading Survivor.");
  }
  const context = await survivorContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });

  const [gamesResult, picksResult, teamsResult, entriesResult, usedPicksResult] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select("id, away_team_id, home_team_id, kickoff_at, status")
      .eq("scoring_period_id", context.period.id)
      .order("kickoff_at"),
    supabaseAdmin
      .from("survivor_picks")
      .select("survivor_entry_id, game_id, selected_team_id, result")
      .eq("scoring_period_id", context.period.id),
    supabaseAdmin.from("teams").select("id, full_name, abbreviation").eq("active", true),
    supabaseAdmin
      .from("survivor_entries")
      .select("id, status, player_id")
      .eq("season_id", context.season.id),
    supabaseAdmin
      .from("survivor_picks")
      .select("selected_team_id")
      .eq("survivor_entry_id", context.entry.id)
      .neq("result", "void"),
  ]);
  if (
    gamesResult.error ||
    picksResult.error ||
    teamsResult.error ||
    entriesResult.error ||
    usedPicksResult.error
  ) {
    return NextResponse.json(
      { error: "The Survivor Wire could not be loaded safely. Please try again." },
      { status: 503 },
    );
  }

  const games = gamesResult.data ?? [];
  const picks = picksResult.data ?? [];
  const teams = teamsResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const usedPicks = usedPicksResult.data ?? [];

  const playerIds = [...new Set(entries.map((entry) => entry.player_id))];
  const { data: players, error: playersError } = playerIds.length
    ? await supabaseAdmin.from("players").select("id, first_name").in("id", playerIds)
    : { data: [], error: null };
  if (playersError) {
    return NextResponse.json(
      { error: "The Survivor standings could not be loaded safely. Please try again." },
      { status: 503 },
    );
  }
  const nameByPlayerId = new Map((players ?? []).map((player) => [player.id, player.first_name]));
  const teamById = new Map(teams.map((team) => [team.id, { name: team.full_name, abbreviation: team.abbreviation }]));
  const myPick = picks.find(
    (pick) => pick.survivor_entry_id === context.entry.id && pick.result !== "void",
  ) ?? null;
  const scheduledTeamIds = new Set(
    games.flatMap((game) => [game.away_team_id, game.home_team_id]),
  );
  const byeTeams = teams
    .filter((team) => !scheduledTeamIds.has(team.id))
    .map((team) => team.abbreviation)
    .sort();

  return NextResponse.json({
    week: { id: context.period.id, name: context.period.display_name, status: context.period.status },
    entry: { status: context.entry.status, pick: myPick },
    usedTeamIds: [...new Set(usedPicks.map((pick) => pick.selected_team_id))],
    byeTeams,
    games: games.map((game) => ({
      id: game.id,
      kickoffAt: game.kickoff_at,
      status: game.status,
      awayTeamId: game.away_team_id,
      homeTeamId: game.home_team_id,
      awayTeam: { id: game.away_team_id, ...(teamById.get(game.away_team_id) ?? { name: "Unknown team", abbreviation: "NFL" }) },
      homeTeam: { id: game.home_team_id, ...(teamById.get(game.home_team_id) ?? { name: "Unknown team", abbreviation: "NFL" }) },
    })),
    entries: entries
      .map((entry) => ({
        id: entry.id,
        name: nameByPlayerId.get(entry.player_id) ?? "Unknown player",
        status: entry.status,
      }))
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1)),
  });
}

export async function POST(request: NextRequest) {
  try {
    await voidDisruptedPicks();
  } catch {
    return NextResponse.json({ error: "Survivor disruption checks could not be completed." }, { status: 503 });
  }
  const context = await survivorContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  let body: { gameId?: string; teamId?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Your Survivor submission was incomplete." },
      { status: 400 },
    );
  }
  const replacementPick = body.gameId && body.teamId
    ? { game_id: body.gameId, selected_team_id: body.teamId }
    : null;

  const { error } = await supabaseAdmin.rpc("replace_unlocked_survivor_pick", {
    target_survivor_entry_id: context.entry.id,
    target_scoring_period_id: context.period.id,
    replacement_pick: replacementPick,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ message: replacementPick ? "Your Survivor pick has been saved." : "Your unlocked Survivor pick has been cleared." });
}
