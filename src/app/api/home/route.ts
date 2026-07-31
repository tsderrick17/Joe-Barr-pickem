import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { nextPickRevealAt, shouldRevealPick } from "@/lib/pick-visibility";
import { selectDefaultScoringPeriod } from "@/lib/scoring-period";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { countPickemWins } from "@/lib/standings";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { eliminateSurvivorNoPicks } from "@/lib/eliminate-survivor-no-picks";
import { loadPlayoffEligibility } from "@/lib/playoff-eligibility";

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
};

type ChampionshipRow = {
  player_id: string;
  pool: "pickem" | "survivor";
  season_year: number;
};

function signedSpread(
  selectedTeamId: string,
  favoriteTeamId: string | null,
  spread: number | string,
) {
  const value = Number(spread);
  if (!Number.isFinite(value)) return null;
  if (value === 0) return "PK";
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return selectedTeamId === favoriteTeamId ? `-${displayValue}` : `+${displayValue}`;
}

type ScoringPeriodRow = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
  period_type: "regular" | "playoff";
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
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error:
          userError && (userError.status ?? 500) >= 500
            ? "The sign-in service could not be reached."
            : "Your sign-in session could not be verified.",
      },
      { status: userError && (userError.status ?? 500) >= 500 ? 503 : 401 },
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
      .eq("year", CURRENT_SEASON_YEAR)
      .maybeSingle(),
    supabaseAdmin
      .from("players")
      .select("id, first_name")
      .eq("active", true)
      .order("first_name"),
  ]);

  if (viewerResult.error || seasonResult.error) {
    return NextResponse.json(
      { error: "The current pool could not be loaded safely." },
      { status: 503 },
    );
  }

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
      { error: `The ${CURRENT_SEASON_YEAR} season has not been set up.` },
      { status: 404 },
    );
  }

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, status, period_type, max_picks")
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

  // A trophy is decorative, never a reason to make the whole pool
  // unavailable while a production migration is still catching up.
  const { data: championSeason } = await supabaseAdmin
    .from("seasons")
    .select("survivor_champion_player_id")
    .eq("id", season.id)
    .maybeSingle();

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
    .in("scoring_period_id", periodIds)
    .neq("result", "void");

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

  const [gamesResult, teamsResult, historyResult, lockedLinesResult] = await Promise.all([
    gameIds.length
      ? supabaseAdmin.from("games").select("id, kickoff_at").in("id", gameIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabaseAdmin.from("teams").select("id, full_name, abbreviation").in("id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    gameIds.length
      ? supabaseAdmin.from("spread_history").select("game_id, favorite_team_id, spread, captured_at").in("game_id", gameIds).order("captured_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    gameIds.length
      ? supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread").in("game_id", gameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    gamesResult.error ||
    teamsResult.error ||
    historyResult.error ||
    lockedLinesResult.error
  ) {
    return NextResponse.json(
      { error: "The weekly Standings details could not be loaded." },
      { status: 503 },
    );
  }

  // A missing decorative ledger must never take down the real standings.
  const { data: championshipRows, error: championshipsError } = await supabaseAdmin
    .from("pool_championships")
    .select("player_id, pool, season_year")
    .order("season_year", { ascending: false });
  if (championshipsError) {
    console.warn("Championship history is unavailable.", { code: championshipsError.code });
  }
  const trophiesByPlayerId = new Map<string, string[]>();
  for (const championship of (championshipRows ?? []) as ChampionshipRow[]) {
    const title = `'${String(championship.season_year).slice(-2)} ${championship.pool === "pickem" ? "Pick'em" : "Survivor"} Champion`;
    const titles = trophiesByPlayerId.get(championship.player_id) ?? [];
    titles.push(title);
    trophiesByPlayerId.set(championship.player_id, titles);
  }

  let playoffEliminatedPlayerIds = new Set<string>();
  if (currentWeek.period_type === "playoff" && currentWeek.status === "active") {
    try {
      const eligibility = await loadPlayoffEligibility(season.id, currentWeek.id, players);
      playoffEliminatedPlayerIds = eligibility.eliminatedPlayerIds;
    } catch {
      return NextResponse.json({ error: "Playoff eligibility could not be calculated safely." }, { status: 503 });
    }
  }

  // The 2026 launch predates the first historical-season record. Keep John as
  // the inaugural displayed holder until this season crowns its own winner.
  const survivorChampionPlayerId =
    championSeason?.survivor_champion_player_id ??
    players.find(
      (player) => player.first_name.trim().toLocaleLowerCase() === "john",
    )?.id ??
    null;
  const survivorComplete = Boolean(championSeason?.survivor_champion_player_id);
  const survivorChampionName = championSeason?.survivor_champion_player_id
    ? players.find((player) => player.id === championSeason.survivor_champion_player_id)?.first_name ?? "Survivor champion"
    : null;
  const games = gamesResult.data;
  const teams = teamsResult.data;

  const gameById = new Map(
    ((games ?? []) as GameRow[]).map((game) => [game.id, game]),
  );
  const currentTime = new Date();
  const atsNextRevealAt = nextPickRevealAt(
    ((games ?? []) as GameRow[]).map((game) => game.kickoff_at),
    currentTime,
  );

  const teamById = new Map(
    (teams ?? []).map((team) => [team.id, { name: team.full_name, abbreviation: team.abbreviation }]),
  );
  const lockedLineByGameId = new Map(
    ((lockedLinesResult.data ?? []) as LockedLineRow[]).map((line) => [line.game_id, line]),
  );
  const preliminaryLineByGameId = new Map<string, PreliminaryLineRow>();
  for (const line of (historyResult.data ?? []) as PreliminaryLineRow[]) {
    if (!preliminaryLineByGameId.has(line.game_id)) preliminaryLineByGameId.set(line.game_id, line);
  }

  const rows = players
    .map((player) => {
      const wins = countPickemWins(
        allPicks.filter((pick) => pick.player_id === player.id),
      );

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

          const lockedLine = lockedLineByGameId.get(pick.game_id);
          const preliminaryLine = preliminaryLineByGameId.get(pick.game_id);
          const line = lockedLine ?? preliminaryLine;

          const team = teamById.get(pick.selected_team_id);
          return {
            label: visible
    ? team?.name ?? "Unknown team"
    : null,
  abbreviation: visible ? team?.abbreviation ?? null : null,
  kickoffAt: game?.kickoff_at,
  isHidden: !visible,
  resultMark: visible ? resultMark : "",
  spread: visible && line
    ? signedSpread(
        pick.selected_team_id,
        line.favorite_team_id,
        lockedLine ? lockedLine.locked_spread : preliminaryLine!.spread,
      )
    : null,
  isLineLocked: Boolean(lockedLine),
};
        });

      return {
        id: player.id,
        firstName: player.first_name,
        trophies: trophiesByPlayerId.get(player.id) ?? [],
        wins,
        playoffEliminated: playoffEliminatedPlayerIds.has(player.id),
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
    eliminatedAt: string | null;
    pick: {
      label: string | null;
      isHidden: boolean;
      resultMark: string;
    } | null;
    picks: Array<{
      abbreviation: string | null;
      label: string | null;
      isHidden: boolean;
      resultMark: string;
    } | null>;
  }> = [];
  let survivorGames: GameRow[] = [];

  const [ensuredEntries, noPickEvaluation] = await Promise.all([
    supabaseAdmin.rpc("ensure_survivor_entries", {
      target_season_id: season.id,
    }),
    eliminateSurvivorNoPicks().catch(() => null),
  ]);

  if (ensuredEntries.error || !noPickEvaluation) {
    survivorAvailable = false;
    survivorNotice =
      "Survivor is temporarily unavailable. ATS standings remain current.";
    console.error("Survivor enrollment failed.", {
      code: ensuredEntries.error?.code ?? "no-pick-evaluation-failed",
    });
  } else {
    const [
      { data: survivorEntries, error: survivorEntriesError },
      { data: survivorPicks, error: survivorPicksError },
    ] = await Promise.all([
      supabaseAdmin
        .from("survivor_entries")
        .select("id, player_id, status, eliminated_at")
        .eq("season_id", season.id),
      supabaseAdmin
        .from("survivor_picks")
        .select("survivor_entry_id, game_id, selected_team_id, scoring_period_id, result")
        .in("scoring_period_id", periodIds)
        .neq("result", "void"),
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
              .select("id, full_name, abbreviation")
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
          (survivorTeams ?? []).map((team) => [team.id, { name: team.full_name, abbreviation: team.abbreviation }]),
        );
        const playerNameById = new Map(
          players.map((player) => [player.id, player.first_name]),
        );
        survivorRows = (survivorEntries ?? [])
          .map((entry) => {
            const entryPicks = (survivorPicks ?? []).filter((item) => item.survivor_entry_id === entry.id);
            const pick = entryPicks.find((item) => item.scoring_period_id === currentWeek.id);
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
              playerId: entry.player_id,
              firstName:
                playerNameById.get(entry.player_id) ?? "Unknown player",
              trophies: trophiesByPlayerId.get(entry.player_id) ?? [],
              status: entry.status,
              eliminatedAt: entry.eliminated_at,
              pick: pick
                ? {
                    label: visible
                      ? survivorTeamById.get(pick.selected_team_id)?.name ??
                        "Unknown team"
                      : null,
                    abbreviation: visible
                      ? survivorTeamById.get(pick.selected_team_id)?.abbreviation ??
                        null
                      : null,
                    isHidden: !visible,
                    resultMark:
                      visible && pick.result === "win"
                        ? "W"
                        : visible && pick.result === "loss"
                          ? "L"
                          : "",
                    kickoffAt: game?.kickoff_at ?? null,
                  }
                : null,
              picks: periods.map((period) => {
                const periodPick = entryPicks.find((item) => item.scoring_period_id === period.id);
                if (!periodPick) return null;
                const periodGame = survivorGameById.get(periodPick.game_id);
                const visible = shouldRevealPick({ viewerPlayerId: viewer.id, pickPlayerId: entry.player_id, kickoffAt: periodGame?.kickoff_at }, currentTime);
                const team = survivorTeamById.get(periodPick.selected_team_id);
                return { abbreviation: visible ? team?.abbreviation ?? null : null, label: visible ? team?.name ?? "Unknown team" : null, isHidden: !visible, resultMark: visible && periodPick.result === "win" ? "W" : visible && periodPick.result === "loss" ? "L" : "" };
              }),
            };
          })
          .sort((first, second) => {
            if (first.status !== second.status) return first.status === "active" ? -1 : 1;
            if (first.status === "active") return first.firstName.localeCompare(second.firstName);
            return new Date(second.eliminatedAt ?? 0).getTime() - new Date(first.eliminatedAt ?? 0).getTime()
              || first.firstName.localeCompare(second.firstName);
          });
      }
    }
  }

  return NextResponse.json({
    viewerPlayerId: viewer.id,
    isPlayoff: currentWeek.period_type === "playoff",
    week: currentWeek.display_name,
    weekStatus: currentWeek.status,
    maxPicks: currentWeek.max_picks,
    nextRevealAt: nextPickRevealAt(
      [...((games ?? []) as GameRow[]).map((game) => game.kickoff_at), ...survivorGames.map((game) => game.kickoff_at)],
      currentTime,
    ) ?? atsNextRevealAt,
    rows,
    survivorAvailable: currentWeek.period_type === "playoff" ? false : survivorAvailable,
    survivorNotice,
    survivorRows,
    survivorChampionPlayerId,
    survivorComplete,
    survivorChampionName,
  });
}
