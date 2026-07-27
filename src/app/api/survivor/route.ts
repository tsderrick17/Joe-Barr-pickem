import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";

export const dynamic = "force-dynamic";

type Period = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
};

async function authenticatedPlayer(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;

  const authClient = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return player?.active ? player : null;
}

async function survivorContext(request: NextRequest) {
  const player = await authenticatedPlayer(request);
  if (!player) return { error: "You must be signed in as an active player.", status: 401 as const };

  const { data: season } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", 2026)
    .maybeSingle();
  if (!season) return { error: "The 2026 season has not been set up.", status: 404 as const };

  const ensured = await supabaseAdmin.rpc("ensure_survivor_entries", {
    target_season_id: season.id,
  });
  if (ensured.error) return { error: "Survivor entries could not be prepared.", status: 500 as const };

  const { data: periods } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, status")
    .eq("season_id", season.id)
    .order("display_order");
  const period = selectDefaultScoringPeriod((periods ?? []) as Period[]);
  if (!period) return { error: "The weekly schedule could not be loaded.", status: 500 as const };

  const { data: entry } = await supabaseAdmin
    .from("survivor_entries")
    .select("id, status, eliminated_at")
    .eq("player_id", player.id)
    .eq("season_id", season.id)
    .maybeSingle();
  if (!entry) return { error: "Your Survivor entry could not be loaded.", status: 500 as const };

  return { player, season, period, entry };
}

export async function GET(request: NextRequest) {
  try {
    await voidDisruptedPicks();
  } catch {
    return NextResponse.json({ error: "Survivor disruption checks could not be completed." }, { status: 503 });
  }
  const context = await survivorContext(request);
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });

  const [{ data: games }, { data: picks }, { data: teams }, { data: entries }, { data: usedPicks }] = await Promise.all([
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

  const playerIds = [...new Set((entries ?? []).map((entry) => entry.player_id))];
  const { data: players } = playerIds.length
    ? await supabaseAdmin.from("players").select("id, first_name").in("id", playerIds)
    : { data: [] };
  const nameByPlayerId = new Map((players ?? []).map((player) => [player.id, player.first_name]));
  const teamById = new Map((teams ?? []).map((team) => [team.id, { name: team.full_name, abbreviation: team.abbreviation }]));
  const myPick = (picks ?? []).find(
    (pick) => pick.survivor_entry_id === context.entry.id && pick.result !== "void",
  ) ?? null;
  const scheduledTeamIds = new Set(
    (games ?? []).flatMap((game) => [game.away_team_id, game.home_team_id]),
  );
  const byeTeams = (teams ?? [])
    .filter((team) => !scheduledTeamIds.has(team.id))
    .map((team) => team.abbreviation)
    .sort();

  return NextResponse.json({
    week: { id: context.period.id, name: context.period.display_name, status: context.period.status },
    entry: { status: context.entry.status, pick: myPick },
    usedTeamIds: [...new Set((usedPicks ?? []).map((pick) => pick.selected_team_id))],
    byeTeams,
    games: (games ?? []).map((game) => ({
      id: game.id,
      kickoffAt: game.kickoff_at,
      status: game.status,
      awayTeamId: game.away_team_id,
      homeTeamId: game.home_team_id,
      awayTeam: { id: game.away_team_id, ...(teamById.get(game.away_team_id) ?? { name: "Unknown team", abbreviation: "NFL" }) },
      homeTeam: { id: game.home_team_id, ...(teamById.get(game.home_team_id) ?? { name: "Unknown team", abbreviation: "NFL" }) },
    })),
    entries: (entries ?? [])
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
