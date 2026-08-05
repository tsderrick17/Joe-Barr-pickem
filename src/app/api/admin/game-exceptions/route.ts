import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

type GameRow = {
  id: string;
  away_team_id: string;
  home_team_id: string;
  scoring_period_id: string;
  kickoff_at: string;
  status: "postponed" | "cancelled" | "no_contest" | "final";
};

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  const [exceptionResult, pendingPickResult, recordableResult] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select("id, away_team_id, home_team_id, scoring_period_id, kickoff_at, status")
      .in("status", ["postponed", "cancelled", "no_contest"])
      .order("kickoff_at"),
    supabaseAdmin.from("picks").select("game_id").eq("result", "pending"),
    supabaseAdmin
      .from("games")
      .select("id, away_team_id, home_team_id, scoring_period_id, kickoff_at")
      .in("status", ["scheduled", "live"])
      .order("kickoff_at"),
  ]);

  if (
    exceptionResult.error ||
    pendingPickResult.error ||
    recordableResult.error ||
    !exceptionResult.data ||
    !pendingPickResult.data
  ) {
    return NextResponse.json(
      { error: "Game exceptions could not be loaded." },
      { status: 500 },
    );
  }

  const pendingGameIds = [
    ...new Set(pendingPickResult.data.map((pick) => pick.game_id)),
  ];
  const pendingGradeResult = pendingGameIds.length
    ? await supabaseAdmin
        .from("games")
        .select("id, away_team_id, home_team_id, scoring_period_id, kickoff_at, status")
        .in("id", pendingGameIds)
        .eq("status", "final")
        .order("kickoff_at")
    : { data: [], error: null };

  if (pendingGradeResult.error || !pendingGradeResult.data) {
    return NextResponse.json(
      { error: "Pending final-game grades could not be loaded." },
      { status: 500 },
    );
  }

  const exceptionGames = [
    ...new Map(
      ([...exceptionResult.data, ...pendingGradeResult.data] as GameRow[]).map(
        (game) => [game.id, game],
      ),
    ).values(),
  ];
  const teamIds = [
    ...new Set(
      [...exceptionGames, ...(recordableResult.data ?? [])].flatMap((game) => [
        game.away_team_id,
        game.home_team_id,
      ]),
    ),
  ];
  const periodIds = [
    ...new Set([...exceptionGames, ...(recordableResult.data ?? [])].map((game) => game.scoring_period_id)),
  ];

  const [teamResult, periodResult] = await Promise.all([
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

  if (teamResult.error || periodResult.error) {
    return NextResponse.json(
      { error: "Game exception details could not be loaded." },
      { status: 500 },
    );
  }

  const teamNameById = new Map(
    (teamResult.data ?? []).map((team) => [team.id, team.full_name]),
  );
  const periodNameById = new Map(
    (periodResult.data ?? []).map((period) => [period.id, period.display_name]),
  );

  const describeGame = (game: GameRow) => {
    const awayTeam = teamNameById.get(game.away_team_id);
    const homeTeam = teamNameById.get(game.home_team_id);
    const week = periodNameById.get(game.scoring_period_id);
    return awayTeam && homeTeam && week
      ? { id: game.id, awayTeam, homeTeam, week, kickoffAt: game.kickoff_at }
      : null;
  };

  const exceptions = exceptionGames.flatMap((game) => {
    const described = describeGame(game);
    return described ? [{ ...described, status: game.status === "final" ? "pending_grade" : game.status }] : [];
  });
  const recordableGames = (recordableResult.data ?? []).flatMap((game) => {
    const described = describeGame({ ...game, status: "final" });
    return described ? [described] : [];
  });

  return NextResponse.json({ exceptions, recordableGames });
}
