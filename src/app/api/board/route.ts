import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type TeamRow = {
  id: string;
  full_name: string;
};

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  const scoringPeriodId =
    new URL(request.url).searchParams.get("scoringPeriodId");

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!authorization?.startsWith("Bearer ") || !scoringPeriodId) {
    return NextResponse.json(
      { error: "You must be signed in to view the board." },
      { status: 401 },
    );
  }

  const authClient = createClient(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Your sign-in session could not be verified." },
      { status: 401 },
    );
  }

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select(
      "id, away_team_id, home_team_id, kickoff_at, line_lock_at",
    )
    .eq("scoring_period_id", scoringPeriodId)
    .order("kickoff_at");

  if (gamesError || !games) {
    return NextResponse.json(
      { error: "The games for this week could not be loaded." },
      { status: 500 },
    );
  }

  const teamIds = [
    ...new Set(
      games.flatMap((game) => [game.away_team_id, game.home_team_id]),
    ),
  ];

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, full_name")
    .in("id", teamIds);

  if (teamsError || !teams) {
    return NextResponse.json(
      { error: "The NFL team list could not be loaded." },
      { status: 500 },
    );
  }

  const { data: history, error: historyError } = await supabaseAdmin
    .from("spread_history")
    .select("game_id, favorite_team_id, captured_at")
    .in(
      "game_id",
      games.map((game) => game.id),
    )
    .order("captured_at", { ascending: false });

  if (historyError) {
    return NextResponse.json(
      { error: "The preliminary team order could not be loaded." },
      { status: 500 },
    );
  }

  const teamNameById = new Map(
    (teams as TeamRow[]).map((team) => [team.id, team.full_name]),
  );

  const favoriteTeamByGameId = new Map<string, string>();

  for (const line of history ?? []) {
    if (!favoriteTeamByGameId.has(line.game_id) && line.favorite_team_id) {
      favoriteTeamByGameId.set(line.game_id, line.favorite_team_id);
    }
  }

  return NextResponse.json({
    games: games.map((game) => ({
      id: game.id,
      kickoffAt: game.kickoff_at,
      lineLockAt: game.line_lock_at,
      awayTeam: teamNameById.get(game.away_team_id) ?? "Unknown team",
      homeTeam: teamNameById.get(game.home_team_id) ?? "Unknown team",
      favoriteTeamId: favoriteTeamByGameId.get(game.id) ?? null,
      awayTeamId: game.away_team_id,
      homeTeamId: game.home_team_id,
    })),
  });
}