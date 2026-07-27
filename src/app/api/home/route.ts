import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { nextPickRevealAt, shouldRevealPick } from "@/lib/pick-visibility";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type PickRow = {
  player_id: string;
  game_id: string;
  selected_team_id: string;
  scoring_period_id: string;
  submitted_at: string;
  result: string;
};

type GameRow = {
  id: string;
  kickoff_at: string;
};

type ScoringPeriodRow = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
  max_picks: number;
};

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "You must be signed in to view the Standings." },
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

  const [viewerResult, seasonResult, playersResult] = await Promise.all([
    supabaseAdmin
      .from("players")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle(),
    supabaseAdmin
      .from("seasons")
      .select("id")
      .eq("year", 2026)
      .maybeSingle(),
    supabaseAdmin
      .from("players")
      .select("id, first_name")
      .eq("active", true)
      .order("first_name"),
  ]);

  const viewer = viewerResult.data;

  if (!viewer) {
    return NextResponse.json(
      { error: "Your player profile is not active in this Pick'em." },
      { status: 403 },
    );
  }

  const season = seasonResult.data;

  if (!season) {
    return NextResponse.json(
      { error: "The 2026 season has not been set up." },
      { status: 404 },
    );
  }

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, status, max_picks")
    .eq("season_id", season.id)
    .order("display_order");

  if (periodsError || !periods?.length) {
    return NextResponse.json(
      { error: "The weekly schedule could not be loaded." },
      { status: 500 },
    );
  }

  const currentWeek = selectDefaultScoringPeriod(
    periods as ScoringPeriodRow[],
  );

  if (!currentWeek) {
    return NextResponse.json(
      { error: "The weekly schedule could not be loaded." },
      { status: 500 },
    );
  }

  const periodIds = periods.map((period) => period.id);

  const { data: players, error: playersError } = playersResult;

  if (playersError || !players) {
    return NextResponse.json(
      { error: "The player list could not be loaded." },
      { status: 500 },
    );
  }

  const { data: picks, error: picksError } = await supabaseAdmin
    .from("picks")
    .select(
      "player_id, game_id, selected_team_id, scoring_period_id, submitted_at, result",
    )
    .in("scoring_period_id", periodIds);

  if (picksError) {
    return NextResponse.json(
      { error: "The Standings picks could not be loaded." },
      { status: 500 },
    );
  }

  const allPicks = (picks ?? []) as PickRow[];

  const currentWeekPicks = allPicks
    .filter((pick) => pick.scoring_period_id === currentWeek.id)
    .sort(
      (first, second) =>
        new Date(first.submitted_at).getTime() -
        new Date(second.submitted_at).getTime(),
    );

  const gameIds = [
    ...new Set(currentWeekPicks.map((pick) => pick.game_id)),
  ];

  const teamIds = [
    ...new Set(currentWeekPicks.map((pick) => pick.selected_team_id)),
  ];

  const { data: games } = gameIds.length
    ? await supabaseAdmin
        .from("games")
        .select("id, kickoff_at")
        .in("id", gameIds)
    : { data: [] };

  const { data: teams } = teamIds.length
    ? await supabaseAdmin
        .from("teams")
        .select("id, full_name")
        .in("id", teamIds)
    : { data: [] };

  const gameById = new Map(
    ((games ?? []) as GameRow[]).map((game) => [game.id, game]),
  );
  const currentTime = new Date();
  const atsNextRevealAt = nextPickRevealAt(
    ((games ?? []) as GameRow[]).map((game) => game.kickoff_at),
    currentTime,
  );

  const teamNameById = new Map(
    (teams ?? []).map((team) => [team.id, team.full_name]),
  );

  const rows = players
    .map((player) => {
      const wins = allPicks.filter(
        (pick) =>
          pick.player_id === player.id && pick.result === "win",
      ).length;

      const weeklyPicks = currentWeekPicks
        .filter((pick) => pick.player_id === player.id)
        .map((pick) => {
          const game = gameById.get(pick.game_id);

          const visible = shouldRevealPick(
            {
              viewerPlayerId: viewer.id,
              pickPlayerId: player.id,
              kickoffAt: game?.kickoff_at,
            },
            currentTime,
          );

          let resultMark = "";

          if (pick.result === "win") {
            resultMark = "W";
          }

          if (pick.result === "loss") {
            resultMark = "L";
          }

return {
  label: visible
    ? teamNameById.get(pick.selected_team_id) ?? "Unknown team"
    : null,
  isHidden: !visible,
  resultMark: visible ? resultMark : "",
};
        });

      return {
        id: player.id,
        firstName: player.first_name,
        wins,
        picks: weeklyPicks,
      };
    })
    .sort(
      (first, second) =>
        second.wins - first.wins ||
        first.firstName.localeCompare(second.firstName),
    );

  let survivorAvailable = true;
  let survivorNotice: string | null = null;
  let survivorRows: Array<{
    id: string;
    firstName: string;
    status: string;
    pick: {
      label: string | null;
      isHidden: boolean;
      resultMark: string;
    } | null;
  }> = [];
  let survivorGames: GameRow[] = [];

  const ensuredEntries = await supabaseAdmin.rpc("ensure_survivor_entries", {
    target_season_id: season.id,
  });

  if (ensuredEntries.error) {
    survivorAvailable = false;
    survivorNotice =
      "Survivor is temporarily unavailable. ATS standings remain current.";
    console.error("Survivor enrollment failed.", {
      code: ensuredEntries.error.code,
    });
  } else {
    const [
      { data: survivorEntries, error: survivorEntriesError },
      { data: survivorPicks, error: survivorPicksError },
    ] = await Promise.all([
      supabaseAdmin
        .from("survivor_entries")
        .select("id, player_id, status")
        .eq("season_id", season.id),
      supabaseAdmin
        .from("survivor_picks")
        .select("survivor_entry_id, game_id, selected_team_id, result")
        .eq("scoring_period_id", currentWeek.id),
    ]);

    if (survivorEntriesError || survivorPicksError) {
      survivorAvailable = false;
      survivorNotice =
        "Survivor is temporarily unavailable. ATS standings remain current.";
      console.error("Survivor standings query failed.", {
        entriesCode: survivorEntriesError?.code,
        picksCode: survivorPicksError?.code,
      });
    } else {
      const survivorGameIds = [
        ...new Set((survivorPicks ?? []).map((pick) => pick.game_id)),
      ];
      const survivorTeamIds = [
        ...new Set((survivorPicks ?? []).map((pick) => pick.selected_team_id)),
      ];
      const [
        { data: survivorGameRows, error: survivorGamesError },
        { data: survivorTeams, error: survivorTeamsError },
      ] = await Promise.all([
        survivorGameIds.length
          ? supabaseAdmin
              .from("games")
              .select("id, kickoff_at")
              .in("id", survivorGameIds)
          : Promise.resolve({ data: [], error: null }),
        survivorTeamIds.length
          ? supabaseAdmin
              .from("teams")
              .select("id, full_name")
              .in("id", survivorTeamIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (survivorGamesError || survivorTeamsError) {
        survivorAvailable = false;
        survivorNotice =
          "Survivor is temporarily unavailable. ATS standings remain current.";
        console.error("Survivor labels query failed.", {
          gamesCode: survivorGamesError?.code,
          teamsCode: survivorTeamsError?.code,
        });
      } else {
        survivorGames = (survivorGameRows ?? []) as GameRow[];
        const survivorGameById = new Map(
          survivorGames.map((game) => [game.id, game]),
        );
        const survivorTeamById = new Map(
          (survivorTeams ?? []).map((team) => [team.id, team.full_name]),
        );
        const playerNameById = new Map(
          players.map((player) => [player.id, player.first_name]),
        );
        survivorRows = (survivorEntries ?? [])
          .map((entry) => {
            const pick = (survivorPicks ?? []).find(
              (item) => item.survivor_entry_id === entry.id,
            );
            const game = pick ? survivorGameById.get(pick.game_id) : null;
            const visible = pick
              ? shouldRevealPick(
                  {
                    viewerPlayerId: viewer.id,
                    pickPlayerId: entry.player_id,
                    kickoffAt: game?.kickoff_at,
                  },
                  currentTime,
                )
              : false;

            return {
              id: entry.id,
              firstName:
                playerNameById.get(entry.player_id) ?? "Unknown player",
              status: entry.status,
              pick: pick
                ? {
                    label: visible
                      ? survivorTeamById.get(pick.selected_team_id) ??
                        "Unknown team"
                      : null,
                    isHidden: !visible,
                    resultMark:
                      visible && pick.result === "win"
                        ? "W"
                        : visible && pick.result === "loss"
                          ? "L"
                          : "",
                  }
                : null,
            };
          })
          .sort((first, second) =>
            first.status === second.status
              ? first.firstName.localeCompare(second.firstName)
              : first.status === "active"
                ? -1
                : 1,
          );
      }
    }
  }

  return NextResponse.json({
    viewerPlayerId: viewer.id,
    week: currentWeek.display_name,
    maxPicks: currentWeek.max_picks,
    nextRevealAt: nextPickRevealAt(
      [...((games ?? []) as GameRow[]).map((game) => game.kickoff_at), ...survivorGames.map((game) => game.kickoff_at)],
      currentTime,
    ) ?? atsNextRevealAt,
    rows,
    survivorAvailable,
    survivorNotice,
    survivorRows,
  });
}
