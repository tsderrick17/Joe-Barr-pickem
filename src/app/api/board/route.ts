import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { gradeAtsPick } from "@/lib/ats-grading";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { shouldShowSurvivorSlateChips } from "@/lib/survivor-chip-visibility";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";
import { eliminateSurvivorNoPicks } from "@/lib/eliminate-survivor-no-picks";
import { loadPlayoffEligibility } from "@/lib/playoff-eligibility";

type TeamRow = {
  id: string;
  full_name: string;
  abbreviation: string;
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
  is_international: boolean;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  away_score: number | null;
  home_score: number | null;
};

type SurvivorPickRow = { game_id: string; selected_team_id: string };
type PublicPickRow = { player_id: string; game_id: string; selected_team_id: string };

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
  try {
    await voidDisruptedPicks();
    await eliminateSurvivorNoPicks();
  } catch {
    // Read-only board access must remain available. Pick saves still fail closed
    // if this integrity check cannot run.
    console.error("Disrupted-game check failed while loading the board.");
  }
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
  } = await authClient.auth.getUser(authorization.slice("Bearer ".length));

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

  const [gamesResult, picksResult, periodResult, publicPicksResult, playersResult] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select(
        "id, away_team_id, home_team_id, kickoff_at, line_lock_at, is_international, status, away_score, home_score",
      )
      .eq("scoring_period_id", scoringPeriodId)
      .order("kickoff_at"),
    supabaseAdmin
      .from("picks")
      .select("game_id, selected_team_id, submitted_at")
      .eq("player_id", player.id)
      .eq("scoring_period_id", scoringPeriodId)
      .neq("result", "void")
      .order("submitted_at"),
    supabaseAdmin
      .from("scoring_periods")
      .select("season_id, period_type, status")
      .eq("id", scoringPeriodId)
      .maybeSingle(),
    supabaseAdmin
      .from("picks")
      .select("player_id, game_id, selected_team_id")
      .eq("scoring_period_id", scoringPeriodId)
      .neq("result", "void"),
    supabaseAdmin
      .from("players")
      .select("id, first_name")
      .eq("active", true),
  ]);

  const { data: games, error: gamesError } = gamesResult;
  const { data: myPicks, error: picksError } = picksResult;
  const { data: period, error: periodError } = periodResult;
  const { data: publicPicks, error: publicPicksError } = publicPicksResult;
  const { data: players, error: playersError } = playersResult;

  if (gamesError || !games) {
    console.error("Slate games query failed.", {
      code: gamesError?.code,
    });
    return NextResponse.json(
      { error: "The games for this week could not be loaded." },
      { status: 500 },
    );
  }

  if (picksError || periodError || !period || publicPicksError || playersError || !players) {
    console.error("Slate bootstrap query failed.", {
      picksCode: picksError?.code,
      periodCode: periodError?.code,
      publicPicksCode: publicPicksError?.code,
      playersCode: playersError?.code,
      missingPeriod: !period,
      missingPlayers: !players,
    });
    return NextResponse.json(
      { error: "Your submitted picks could not be loaded." },
      { status: 500 },
    );
  }

  // Survivor remains visible as a colored, static audit surface for the rest
  // of the Eastern day on which a champion is crowned. The following day it
  // leaves The Slate for everybody, while the finished pool stays in history.
  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons")
    .select("survivor_champion_player_id, survivor_champion_crowned_at")
    .eq("id", period.season_id)
    .maybeSingle();

  if (seasonError || !season) {
    console.error("Slate season query failed.", {
      code: seasonError?.code,
      missingSeason: !season,
    });
    return NextResponse.json(
      { error: "The current season could not be loaded safely." },
      { status: 503 },
    );
  }

  const survivorChipsVisible = shouldShowSurvivorSlateChips({
    periodType: period.period_type,
    championCrownedAt: season.survivor_champion_player_id
      ? season.survivor_champion_crowned_at
      : null,
  });

  let playoffEliminated = false;
  if (period.period_type === "playoff" && period.status === "active") {
    try {
      const eligibility = await loadPlayoffEligibility(period.season_id, scoringPeriodId, players);
      playoffEliminated = eligibility.eliminatedPlayerIds.has(player.id);
    } catch (error) {
      console.error("Playoff eligibility check failed on The Slate.", {
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Playoff eligibility could not be verified safely." }, { status: 503 });
    }
  }

  let survivor: {
    available: boolean;
    chipsVisible: boolean;
    notice: string | null;
    status: "active" | "eliminated" | "complete";
    pick: SurvivorPickRow | null;
    usedTeamIds: string[];
  } = {
    available: false,
    chipsVisible: survivorChipsVisible,
    notice:
      "Survivor is temporarily unavailable. ATS picks remain available.",
    status: "active",
    pick: null,
    usedTeamIds: [],
  };

  const ensuredEntries = await supabaseAdmin.rpc("ensure_survivor_entries", {
    target_season_id: period.season_id,
  });

  if (ensuredEntries.error) {
    console.error("Survivor enrollment failed on The Slate.", {
      code: ensuredEntries.error.code,
    });
  } else {
    const { data: survivorEntry, error: survivorEntryError } =
      await supabaseAdmin
        .from("survivor_entries")
        .select("id, status")
        .eq("player_id", player.id)
        .eq("season_id", period.season_id)
        .maybeSingle();

    if (survivorEntryError || !survivorEntry) {
      console.error("Survivor entry query failed on The Slate.", {
        code: survivorEntryError?.code,
      });
    } else {
      const [
        { data: survivorPick, error: survivorPickError },
        { data: usedSurvivorPicks, error: usedSurvivorPicksError },
      ] = await Promise.all([
        supabaseAdmin
          .from("survivor_picks")
          .select("game_id, selected_team_id")
          .eq("survivor_entry_id", survivorEntry.id)
          .eq("scoring_period_id", scoringPeriodId)
          .neq("result", "void")
          .maybeSingle(),
        supabaseAdmin
          .from("survivor_picks")
          .select("selected_team_id")
          .eq("survivor_entry_id", survivorEntry.id)
          // The active week's pick is editable until kickoff. It must never
          // be treated as a prior-season use when a player changes teams.
          .neq("scoring_period_id", scoringPeriodId)
          .neq("result", "void"),
      ]);

      if (survivorPickError || usedSurvivorPicksError) {
        console.error("Survivor selection query failed on The Slate.", {
          pickCode: survivorPickError?.code,
          usedCode: usedSurvivorPicksError?.code,
        });
      } else {
        survivor = {
          available: true,
          chipsVisible: survivorChipsVisible,
          notice: null,
          status: season.survivor_champion_player_id ? "complete" : survivorEntry.status,
          pick: survivorPick as SurvivorPickRow | null,
          usedTeamIds: (usedSurvivorPicks ?? []).map(
            (pick) => pick.selected_team_id,
          ),
        };
      }
    }
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
      .select("id, full_name, abbreviation")
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
  const teamAbbreviationById = new Map(
    (teams as TeamRow[]).map((team) => [team.id, team.abbreviation]),
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
  const playerNameById = new Map(players.map((item) => [item.id, item.first_name]));
  const pickersByGameAndTeam = new Map<string, string[]>();
  for (const pick of (publicPicks ?? []) as PublicPickRow[]) {
    const key = `${pick.game_id}:${pick.selected_team_id}`;
    const names = pickersByGameAndTeam.get(key) ?? [];
    const name = playerNameById.get(pick.player_id);
    if (name) names.push(name);
    pickersByGameAndTeam.set(key, names);
  }
  const currentTime = new Date();

  // Survivor is a regular-season competition. The playoff ticket uses this
  // reclaimed space for every Pick'em game in the active round instead.
  if (period.period_type === "playoff") {
    survivor = {
      available: false,
      chipsVisible: false,
      notice: "Survivor has concluded for the season.",
      status: "complete",
      pick: null,
      usedTeamIds: [],
    };
  }

  return NextResponse.json({
    serverTime: currentTime.toISOString(),
    games: (games as GameRow[]).map((game) => {
      const lockedLine = lockedLineByGameId.get(game.id);

      return {
        id: game.id,
        kickoffAt: game.kickoff_at,
        lineLockAt: game.line_lock_at,
        isInternational: game.is_international,
        awayTeam:
          teamNameById.get(game.away_team_id) ?? "Unknown team",
        homeTeam:
          teamNameById.get(game.home_team_id) ?? "Unknown team",
        awayTeamAbbreviation: teamAbbreviationById.get(game.away_team_id) ?? "NFL",
        homeTeamAbbreviation: teamAbbreviationById.get(game.home_team_id) ?? "NFL",
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
        status: game.status,
        awayScore: game.away_score,
        homeScore: game.home_score,
        awayResult: atsResultForTeam(game, lockedLine, game.away_team_id),
        homeResult: atsResultForTeam(game, lockedLine, game.home_team_id),
        awayPickers: new Date(game.kickoff_at) <= currentTime
          ? pickersByGameAndTeam.get(`${game.id}:${game.away_team_id}`) ?? []
          : [],
        homePickers: new Date(game.kickoff_at) <= currentTime
          ? pickersByGameAndTeam.get(`${game.id}:${game.home_team_id}`) ?? []
          : [],
      };
    }),
    myPicks: (myPicks ?? []).map((pick) => ({
      gameId: pick.game_id,
      teamId: pick.selected_team_id,
    })),
    pickem: {
      playoffEliminated,
    },
    survivor,
  });
}
