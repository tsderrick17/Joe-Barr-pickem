import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type GameRow = {
  id: string;
  away_team_id: string;
  home_team_id: string;
  scoring_period_id: string;
  kickoff_at: string;
  status: "postponed" | "cancelled";
};

async function requireCommissioner(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) return false;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("active, is_commissioner")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return Boolean(player?.active && player.is_commissioner);
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, away_team_id, home_team_id, scoring_period_id, kickoff_at, status")
    .in("status", ["postponed", "cancelled"])
    .order("kickoff_at");

  if (gamesError || !games) {
    return NextResponse.json(
      { error: "Game exceptions could not be loaded." },
      { status: 500 },
    );
  }

  const exceptionGames = games as GameRow[];
  const teamIds = [
    ...new Set(exceptionGames.flatMap((game) => [game.away_team_id, game.home_team_id])),
  ];
  const periodIds = [...new Set(exceptionGames.map((game) => game.scoring_period_id))];

  const [{ data: teams, error: teamsError }, { data: periods, error: periodsError }] =
    await Promise.all([
      teamIds.length
        ? supabaseAdmin.from("teams").select("id, full_name").in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      periodIds.length
        ? supabaseAdmin
            .from("scoring_periods")
            .select("id, display_name")
            .in("id", periodIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (teamsError || periodsError) {
    return NextResponse.json(
      { error: "Game exception details could not be loaded." },
      { status: 500 },
    );
  }

  const teamNameById = new Map(
    (teams ?? []).map((team) => [team.id, team.full_name]),
  );
  const periodNameById = new Map(
    (periods ?? []).map((period) => [period.id, period.display_name]),
  );

  return NextResponse.json({
    exceptions: exceptionGames.map((game) => ({
      id: game.id,
      awayTeam: teamNameById.get(game.away_team_id) ?? "Unknown team",
      homeTeam: teamNameById.get(game.home_team_id) ?? "Unknown team",
      week: periodNameById.get(game.scoring_period_id) ?? "Unknown week",
      kickoffAt: game.kickoff_at,
      status: game.status,
    })),
  });
}
