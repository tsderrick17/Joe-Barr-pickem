import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { gradeAtsPick } from "@/lib/ats-grading";
import { supabaseAdmin } from "@/lib/supabase-admin";

type TeamRow = {
  id: string;
  full_name: string;
};

type PreliminaryLineRow = {
  game_id: string;
  favorite_team_id: string | null;
  spread: number | string;
  captured_at: string;
};

type LockedLineRow = {
  game_id: string;
  favorite_team_id: string | null;
  locked_spread: number | string;
  source: string;
  locked_at: string;
};

type GameRow = {
  id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  line_lock_at: string;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  away_score: number | null;
  home_score: number | null;
};

type SurvivorPickRow = { game_id: string; selected_team_id: string };

function atsResultForTeam(
  game: GameRow,
  lockedLine: LockedLineRow | undefined,
  teamId: string,
) {
  if (game.status !== "final" || !lockedLine) return null;

  const result = gradeAtsPick({
    selectedTeamId: teamId,
    favoriteTeamId: lockedLine.favorite_team_id,
    lockedSpread: Number(lockedLine.locked_spread),
    awayTeamId: game.away_team_id,
    homeTeamId: game.home_team_id,
    awayScore: game.away_score,
    homeScore: game.home_score,
  });

  return result === "pending" ? null : result;
}

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

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!player || !player.active) {
    return NextResponse.json(
      { error: "Your player profile is not active in this Pick'em." },
      { status: 403 },
    );
  }

  const [gamesResult, picksResult, periodResult] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select(
        "id, away_team_id, home_team_id, kickoff_at, line_lock_at, status, away_score, home_score",
      )
      .eq("scoring_period_id", scoringPeriodId)
      .order("kickoff_at"),
    supabaseAdmin
      .from("picks")
      .select("game_id, selected_team_id, submitted_at")
      .eq("player_id", player.id)
      .eq("scoring_period_id", scoringPeriodId)
      .order("submitted_at"),
    supabaseAdmin
      .from("scoring_periods")
      .select("season_id")
      .eq("id", scoringPeriodId)
      .maybeSingle(),
  ]);

  const { data: games, error: gamesError } = gamesResult;
  const { data: myPicks, error: picksError } = picksResult;
  const { data: period, error: periodError } = periodResult;

  if (gamesError || !games) {
    return NextResponse.json(
      { error: "The games for this week could not be loaded." },
      { status: 500 },
    );
  }

  if (picksError || periodError || !period) {
    return NextResponse.json(
      { error: "Your submitted picks could not be loaded." },
      { status: 500 },
    );
  }

  const ensuredEntries = await supabaseAdmin.rpc("ensure_survivor_entries", {
    target_season_id: period.season_id,
  });
  if (ensuredEntries.error) {
    return NextResponse.json({ error: "Survivor entries could not be prepared." }, { status: 500 });
  }

  const { data: survivorEntry, error: survivorEntryError } = await supabaseAdmin
    .from("survivor_entries")
    .select("id, status")
    .eq("player_id", player.id)
    .eq("season_id", period.season_id)
    .maybeSingle();
  if (survivorEntryError || !survivorEntry) {
    return NextResponse.json({ error: "Your Survivor entry could not be loaded." }, { status: 500 });
  }

  const [{ data: survivorPicks, error: survivorPicksError }, { data: usedSurvivorPicks, error: usedSurvivorPicksError }] = await Promise.all([
    supabaseAdmin.from("survivor_picks").select("game_id, selected_team_id").eq("survivor_entry_id", survivorEntry.id).eq("scoring_period_id", scoringPeriodId).maybeSingle(),
    supabaseAdmin.from("survivor_picks").select("selected_team_id").eq("survivor_entry_id", survivorEntry.id),
  ]);
  if (survivorPicksError || usedSurvivorPicksError) {
    return NextResponse.json({ error: "Your Survivor selection could not be loaded." }, { status: 500 });
  }

  const teamIds = [
    ...new Set(
      games.flatMap((game) => [
        game.away_team_id,
        game.home_team_id,
      ]),
    ),
  ];

  const gameIds = games.map((game) => game.id);

  const [teamsResult, historyResult, lockedLinesResult] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, full_name")
      .in("id", teamIds),
    gameIds.length > 0
      ? supabaseAdmin
        .from("spread_history")
          .select("game_id, favorite_team_id, spread, captured_at")
          .in("game_id", gameIds)
          .order("captured_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    gameIds.length > 0
      ? supabaseAdmin
          .from("game_lines")
          .select(
            "game_id, favorite_team_id, locked_spread, source, locked_at",
          )
          .in("game_id", gameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const { data: teams, error: teamsError } = teamsResult;
  const { data: history, error: historyError } = historyResult;
  const { data: lockedLines, error: lockedLinesError } = lockedLinesResult;

  if (teamsError || !teams) {
    return NextResponse.json(
      { error: "The NFL team list could not be loaded." },
      { status: 500 },
    );
  }

  if (historyError) {
    return NextResponse.json(
      { error: "The preliminary team order could not be loaded." },
      { status: 500 },
    );
  }

  if (lockedLinesError) {
    return NextResponse.json(
      { error: "The official spreads could not be loaded." },
      { status: 500 },
    );
  }

  const teamNameById = new Map(
    (teams as TeamRow[]).map((team) => [
      team.id,
      team.full_name,
    ]),
  );

  const preliminaryLineByGameId = new Map<string, PreliminaryLineRow>();

  for (const line of (history ?? []) as PreliminaryLineRow[]) {
    if (!preliminaryLineByGameId.has(line.game_id)) {
      preliminaryLineByGameId.set(line.game_id, line);
    }
  }

  const lockedLineByGameId = new Map(
    ((lockedLines ?? []) as LockedLineRow[]).map((line) => [
      line.game_id,
      line,
    ]),
  );

  return NextResponse.json({
    games: (games as GameRow[]).map((game) => {
      const lockedLine = lockedLineByGameId.get(game.id);

      return {
        id: game.id,
        kickoffAt: game.kickoff_at,
        lineLockAt: game.line_lock_at,
        awayTeam:
          teamNameById.get(game.away_team_id) ?? "Unknown team",
        homeTeam:
          teamNameById.get(game.home_team_id) ?? "Unknown team",
        favoriteTeamId:
          lockedLine?.favorite_team_id ??
          preliminaryLineByGameId.get(game.id)?.favorite_team_id ??
          null,
        awayTeamId: game.away_team_id,
        homeTeamId: game.home_team_id,
        officialSpread: lockedLine
          ? Number(lockedLine.locked_spread)
          : null,
        preliminarySpread: lockedLine
          ? null
          : preliminaryLineByGameId.has(game.id)
            ? Number(preliminaryLineByGameId.get(game.id)?.spread)
            : null,
        spreadSource: lockedLine?.source ?? null,
        spreadLockedAt: lockedLine?.locked_at ?? null,
        awayResult: atsResultForTeam(game, lockedLine, game.away_team_id),
        homeResult: atsResultForTeam(game, lockedLine, game.home_team_id),
      };
    }),
    myPicks: (myPicks ?? []).map((pick) => ({
      gameId: pick.game_id,
      teamId: pick.selected_team_id,
    })),
    survivor: {
      status: survivorEntry.status,
      pick: survivorPicks as SurvivorPickRow | null,
      usedTeamIds: (usedSurvivorPicks ?? []).map((pick) => pick.selected_team_id),
    },
  });
}
