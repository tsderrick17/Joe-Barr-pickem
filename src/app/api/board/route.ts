import { createClient } from "@supabase/supabase-js";
import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { shouldShowSurvivorSlateChips } from "@/lib/survivor-chip-visibility";
import { loadPlayoffEligibility } from "@/lib/playoff-eligibility";
import { recordPlayerActivity } from "@/lib/player-activity";
import {
  selectAvailableScoringPeriods,
  selectDefaultScoringPeriod,
} from "@/lib/scoring-period";
import { currentSeasonYear } from "@/lib/season";
import { nextWeekManualAccessAt } from "@/lib/week-rollover";
import { isSettledGameStatus } from "@/lib/game-status-policy.js";
import type { SlateResponse, SlateScoringPeriod as ScoringPeriodRow } from "@/lib/api-contracts";
import {
  activeSurvivor,
  concludedSurvivor,
  shapeSlateGames,
  unavailableSurvivor,
  type GameRow,
  type LockedLineRow,
  type PreliminaryLineRow,
  type PublicPickRow,
  type SlateSurvivor,
  type SurvivorPickRow,
  type TeamRow,
} from "@/lib/slate-shape";

export async function GET(request: NextRequest) {
  // Disruption voiding and Survivor no-pick settlement run in the protected
  // line-lock and score workers. Keeping this endpoint read-only means a
  // player never waits on pool-wide maintenance just to open The Slate.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  const query = new URL(request.url).searchParams;
  let scoringPeriodId = query.get("scoringPeriodId");
  const bootstrapRequested = query.get("bootstrap") === "1";

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
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

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("id, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // A database hiccup must not tell a real player their profile is inactive.
  if (playerError) {
    return NextResponse.json({ error: "Pick'em is having trouble reaching its records right now. Please try again in a minute." }, { status: 503 });
  }

  if (!player || !player.active) {
    return NextResponse.json(
      { error: "Your player profile is not active in this Pick'em." },
      { status: 403 },
    );
  }
  // Presence is Commissioner-facing information, never a prerequisite for
  // rendering a player's Slate. Run it after the response is handed back.
  after(() => recordPlayerActivity(player.id));

  let bootstrap: {
    weeks: ScoringPeriodRow[];
    nextWeekAvailableAt: string | null;
  } | null = null;

  // The normal player entry point deliberately resolves its week on the
  // server. That replaces three browser-to-database setup reads with this one
  // authenticated request, while the eventual Slate data remains live.
  if (bootstrapRequested && !scoringPeriodId) {
    const { data: season, error: seasonError } = await supabaseAdmin
      .from("seasons")
      .select("id")
      .eq("year", currentSeasonYear())
      .maybeSingle();

    if (seasonError || !season) {
      return NextResponse.json(
        { error: "The current season could not be loaded." },
        { status: 503 },
      );
    }

    const { data: periodRows, error: periodsError } = await supabaseAdmin
      .from("scoring_periods")
      .select("id, display_name, display_order, status, period_type, max_picks")
      .eq("season_id", season.id)
      .order("display_order");

    const weeks = (periodRows ?? []) as ScoringPeriodRow[];
    if (periodsError || weeks.length === 0) {
      return NextResponse.json(
        { error: "The weekly schedule could not be loaded." },
        { status: 503 },
      );
    }

    const activePeriod = weeks.find((period) => period.status === "active");
    let nextWeekAvailableAt: string | null = null;

    if (activePeriod) {
      const { data: activeGames } = await supabaseAdmin
        .from("games")
        .select("kickoff_at, status, finalized_at")
        .eq("scoring_period_id", activePeriod.id);

      if (
        activeGames?.length &&
        activeGames.every((game) => isSettledGameStatus(game.status))
      ) {
        const settlementTimes = activeGames.map((game) =>
          game.finalized_at ??
          (["postponed", "cancelled", "no_contest"].includes(game.status)
            ? game.kickoff_at
            : null),
        );

        if (settlementTimes.every((value): value is string => Boolean(value))) {
          nextWeekAvailableAt = nextWeekManualAccessAt(
            settlementTimes.sort().at(-1)!,
          );
        }
      }
    }

    const availableWeeks = selectAvailableScoringPeriods(weeks, {
      now: Date.now(),
      nextWeekAvailableAt: nextWeekAvailableAt
        ? Date.parse(nextWeekAvailableAt)
        : null,
    }) as ScoringPeriodRow[];
    const requestedWeekId = query.get("week");
    const requestedWeek = requestedWeekId
      ? availableWeeks.find((period) => period.id === requestedWeekId)
      : null;
    const selectedWeek = requestedWeek ?? selectDefaultScoringPeriod(weeks);

    if (!selectedWeek) {
      return NextResponse.json(
        { error: "The weekly schedule could not be loaded." },
        { status: 503 },
      );
    }

    scoringPeriodId = selectedWeek.id;
    bootstrap = { weeks, nextWeekAvailableAt };
  }

  if (!scoringPeriodId) {
    return NextResponse.json(
      { error: "You must choose a week before viewing the board." },
      { status: 400 },
    );
  }

  const [gamesResult, picksResult, periodResult, playersResult] = await Promise.all([
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
      .from("players")
      .select("id, first_name, show_pool_action")
      .eq("active", true),
  ]);

  const { data: games, error: gamesError } = gamesResult;
  const { data: myPicks, error: picksError } = picksResult;
  const { data: period, error: periodError } = periodResult;
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

  if (picksError || periodError || !period || playersError || !players) {
    console.error("Slate bootstrap query failed.", {
      picksCode: picksError?.code,
      periodCode: periodError?.code,
      playersCode: playersError?.code,
      missingPeriod: !period,
      missingPlayers: !players,
    });
    return NextResponse.json(
      { error: "Your submitted picks could not be loaded." },
      { status: 500 },
    );
  }

  // Pick names are only public after kickoff. Skipping this query entirely for
  // a fresh Slate avoids loading every player's upcoming selections, while a
  // kickoff refresh fetches precisely the started games that need disclosure.
  const currentTime = new Date();
  const startedGameIds = (games as GameRow[])
    .filter((game) => new Date(game.kickoff_at) <= currentTime)
    .map((game) => game.id);
  const { data: publicPicks, error: publicPicksError } = startedGameIds.length
    ? await supabaseAdmin
      .from("picks")
      .select("player_id, game_id, selected_team_id")
      .eq("scoring_period_id", scoringPeriodId)
      .in("game_id", startedGameIds)
      .neq("result", "void")
    : { data: [], error: null };

  if (publicPicksError) {
    console.error("Slate public picks query failed.", {
      publicPicksCode: publicPicksError.code,
    });
    return NextResponse.json(
      { error: "The public picks for started games could not be loaded." },
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

  const teamIds = [
    ...new Set(
      games.flatMap((game) => [
        game.away_team_id,
        game.home_team_id,
      ]),
    ),
  ];

  const gameIds = games.map((game) => game.id);
  const teamAndLineResults = Promise.all([
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

  let survivor: SlateSurvivor = unavailableSurvivor(survivorChipsVisible);

  if (period.period_type !== "playoff") {
    let { data: survivorEntry, error: survivorEntryError } =
      await supabaseAdmin
        .from("survivor_entries")
        .select("id, status, eliminated_scoring_period_id")
        .eq("player_id", player.id)
        .eq("season_id", period.season_id)
        .maybeSingle();

    // New or reactivated players are still enrolled automatically, but the
    // common path does not perform a pool-wide upsert for every page view.
    if (!survivorEntry && !survivorEntryError) {
      const ensuredEntries = await supabaseAdmin.rpc("ensure_survivor_entries", {
        target_season_id: period.season_id,
      });
      if (ensuredEntries.error) {
        console.error("Survivor enrollment failed on The Slate.", {
          code: ensuredEntries.error.code,
        });
      } else {
        const retry = await supabaseAdmin
          .from("survivor_entries")
          .select("id, status, eliminated_scoring_period_id")
          .eq("player_id", player.id)
          .eq("season_id", period.season_id)
          .maybeSingle();
        survivorEntry = retry.data;
        survivorEntryError = retry.error;
      }
    }

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
        survivor = activeSurvivor({
          entry: survivorEntry as { status: "active" | "eliminated"; eliminated_scoring_period_id: string | null },
          pick: survivorPick as SurvivorPickRow | null,
          usedPicks: usedSurvivorPicks,
          season,
          scoringPeriodId,
          periodType: period.period_type,
          periodFirstKickoffAt: gamesResult.data?.[0]?.kickoff_at ?? null,
          chipsVisible: survivorChipsVisible,
        });
      }
    }
  }

  const [teamsResult, historyResult, lockedLinesResult] = await teamAndLineResults;

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

  // Survivor is a regular-season competition. The playoff ticket uses this
  // reclaimed space for every Pick'em game in the active round instead.
  if (period.period_type === "playoff") survivor = concludedSurvivor();

  return NextResponse.json({
    serverTime: currentTime.toISOString(),
    games: shapeSlateGames({
      games: games as GameRow[],
      teams: teams as TeamRow[],
      history: history as PreliminaryLineRow[] | null,
      lockedLines: lockedLines as LockedLineRow[] | null,
      publicPicks: publicPicks as PublicPickRow[] | null,
      players,
      now: currentTime,
    }),
    myPicks: (myPicks ?? []).map((pick) => ({
      gameId: pick.game_id,
      teamId: pick.selected_team_id,
    })),
    pickem: {
      playoffEliminated,
    },
    survivor,
    bootstrap,
    showPoolAction: Boolean((players ?? []).find((item) => item.id === player.id)?.show_pool_action),
  } satisfies SlateResponse);
}
