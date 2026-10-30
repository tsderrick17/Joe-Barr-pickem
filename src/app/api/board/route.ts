import { after, NextRequest, NextResponse } from "next/server";
import { authenticateActivePlayer } from "@/lib/authenticate-active-player";
import { playerAccessErrorMessage } from "@/lib/player-access-result";
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
import type { SeasonPhase, SlateResponse, SlateScoringPeriod as ScoringPeriodRow } from "@/lib/api-contracts";
import { seasonPhaseFromRows } from "@/lib/season-phase";
import {
  activeSurvivor,
  concludedSurvivor,
  shapeSlateGames,
  unavailableSurvivor,
  type GameRow,
  type SlateSurvivor,
} from "@/lib/slate-shape";

export async function GET(request: NextRequest) {
  // Disruption voiding and Survivor no-pick settlement run in the protected
  // line-lock and score workers. Keeping this endpoint read-only means a
  // player never waits on pool-wide maintenance just to open The Slate.
  const query = new URL(request.url).searchParams;
  let scoringPeriodId = query.get("scoringPeriodId");
  const bootstrapRequested = query.get("bootstrap") === "1";

  const access = await authenticateActivePlayer(request);
  if (!access.ok) return NextResponse.json(
    { error: playerAccessErrorMessage(access.code), code: access.code },
    { status: access.status },
  );
  const { player } = access;
  // Presence is Commissioner-facing information, never a prerequisite for
  // rendering a player's Slate. Run it after the response is handed back.
  after(() => recordPlayerActivity(player.id));

  // The reads run in as few rounds as their dependencies allow (each round waits on the database once). Failures are
  // still judged in the order the Slate has always reported them.
  const slateReads = (weekId: string) => Promise.all([
    supabaseAdmin
      .from("games")
      .select(
        "id, away_team_id, home_team_id, kickoff_at, line_lock_at, is_international, status, away_score, home_score",
      )
      .eq("scoring_period_id", weekId)
      .order("kickoff_at"),
    supabaseAdmin
      .from("picks")
      .select("game_id, selected_team_id, submitted_at")
      .eq("player_id", player.id)
      .eq("scoring_period_id", weekId)
      .neq("result", "void")
      .order("submitted_at"),
    supabaseAdmin
      .from("scoring_periods")
      .select("season_id, period_type, status")
      .eq("id", weekId)
      .maybeSingle(),
    supabaseAdmin
      .from("players")
      .select("id, first_name, show_pool_action")
      .eq("active", true),
  ]);
  let earlySlateReads: ReturnType<typeof slateReads> | null = null;
  let bootstrapEarly = false;

  let seasonPhase: SeasonPhase | undefined;
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
      .select("id, state")
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

    // Status and type columns are text with CHECK constraints; src/lib/db-statuses.ts lists the allowed values.
    const weeks = (periodRows ?? []) as ScoringPeriodRow[];
    if (periodsError || weeks.length === 0) {
      return NextResponse.json(
        { error: "The weekly schedule could not be loaded." },
        { status: 503 },
      );
    }

    const activePeriod = weeks.find((period) => period.status === "active");
    let nextWeekAvailableAt: string | null = null;
    const requestedWeekId = query.get("week");
    const activeGamesRead = activePeriod
      ? Promise.resolve(supabaseAdmin
        .from("games")
        .select("kickoff_at, status, finalized_at")
        .eq("scoring_period_id", activePeriod.id))
      : null;
    // Without a requested week, the default week does not depend on the active week's games (they only decide when
    // the next week may be opened by hand), so they are read alongside the Slate's own reads below.
    if (activeGamesRead && !requestedWeekId) {
      const selectedWeek = selectDefaultScoringPeriod(weeks);
      if (selectedWeek) {
        earlySlateReads = slateReads(selectedWeek.id);
        bootstrapEarly = true;
      }
    }

    if (activeGamesRead) {
      const { data: activeGames } = await activeGamesRead;

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
    });
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
    seasonPhase = seasonPhaseFromRows(season, periodRows ?? []);
  }

  if (!scoringPeriodId) {
    return NextResponse.json(
      { error: "You must choose a week before viewing the board." },
      { status: 400 },
    );
  }

  const [gamesResult, picksResult, periodResult, playersResult] = await (
    earlySlateReads && bootstrapEarly ? earlySlateReads : slateReads(scoringPeriodId)
  );

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
  const startedGameIds = (games)
    .filter((game) => new Date(game.kickoff_at) <= currentTime)
    .map((game) => game.id);
  const weekId = scoringPeriodId;
  const publicPicksRead = startedGameIds.length
    ? Promise.resolve(supabaseAdmin
      .from("picks")
      .select("player_id, game_id, selected_team_id")
      .eq("scoring_period_id", weekId)
      .in("game_id", startedGameIds)
      .neq("result", "void"))
    : Promise.resolve({ data: [], error: null });
  const seasonRead = Promise.resolve(supabaseAdmin
    .from("seasons")
    .select("survivor_champion_player_id, survivor_champion_crowned_at")
    .eq("id", period.season_id)
    .maybeSingle());
  const eligibilityRead = period.period_type === "playoff" && period.status === "active"
    ? loadPlayoffEligibility(period.season_id, weekId, players).then(
      (eligibility) => ({ ok: true as const, eligibility }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    : null;
  const survivorRead = period.period_type !== "playoff" ? readSurvivorSelection(player.id, period.season_id, weekId) : null;
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
  // A Slate that returns early never waits on these; an unexpected failure must not go unhandled.
  for (const read of [seasonRead, survivorRead, teamAndLineResults]) read?.catch(() => undefined);

  const { data: publicPicks, error: publicPicksError } = await publicPicksRead;

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
  const { data: season, error: seasonError } = await seasonRead;

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
  let playoffForfeited = false;
  let forfeitAvailable = false;
  if (eligibilityRead) {
    const result = await eligibilityRead;
    if (!result.ok) {
      console.error("Playoff eligibility check failed on The Slate.", {
        message: result.error instanceof Error ? result.error.message : String(result.error),
      });
      return NextResponse.json({ error: "Playoff eligibility could not be verified safely." }, { status: 503 });
    }
    playoffEliminated = result.eligibility.eliminatedPlayerIds.has(player.id);
    playoffForfeited = result.eligibility.forfeitedPlayerIds.has(player.id);
    // The Forfeit link is there once the playoffs are open for picks, for a player still in the race who has not already forfeited.
    forfeitAvailable = !playoffEliminated && !playoffForfeited;
  }

  let survivor: SlateSurvivor = unavailableSurvivor(survivorChipsVisible);

  if (survivorRead) {
    const selection = await survivorRead;
    if (selection.ok) {
      survivor = activeSurvivor({
        entry: selection.entry,
        pick: selection.pick,
        usedPicks: selection.usedPicks,
        season,
        scoringPeriodId: weekId,
        periodType: period.period_type === "playoff" ? "playoff" : "regular",
        periodFirstKickoffAt: gamesResult.data?.[0]?.kickoff_at ?? null,
        chipsVisible: survivorChipsVisible,
      });
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
      teams: teams,
      history: history,
      lockedLines: lockedLines,
      publicPicks: publicPicks,
      players,
      now: currentTime,
    }),
    myPicks: (myPicks ?? []).map((pick) => ({
      gameId: pick.game_id,
      teamId: pick.selected_team_id,
    })),
    pickem: {
      playoffEliminated,
      forfeit: { available: forfeitAvailable, forfeited: playoffForfeited },
    },
    survivor,
    bootstrap,
    seasonPhase,
    showPoolAction: Boolean((players ?? []).find((item) => item.id === player.id)?.show_pool_action),
  } satisfies SlateResponse);
}

/**
 * The player's Survivor entry and selections for the week (enrolling a new or reactivated player first). The common
 * path does not perform a pool-wide upsert for every page view. A failed read is logged and leaves Survivor
 * unavailable on the Slate, never the whole Slate.
 */
async function readSurvivorSelection(playerId: string, seasonId: string, scoringPeriodId: string) {
  let { data: survivorEntry, error: survivorEntryError } =
    await supabaseAdmin
      .from("survivor_entries")
      .select("id, status, eliminated_scoring_period_id")
      .eq("player_id", playerId)
      .eq("season_id", seasonId)
      .maybeSingle();

  if (!survivorEntry && !survivorEntryError) {
    const ensuredEntries = await supabaseAdmin.rpc("ensure_survivor_entries", {
      target_season_id: seasonId,
    });
    if (ensuredEntries.error) {
      console.error("Survivor enrollment failed on The Slate.", {
        code: ensuredEntries.error.code,
      });
    } else {
      const retry = await supabaseAdmin
        .from("survivor_entries")
        .select("id, status, eliminated_scoring_period_id")
        .eq("player_id", playerId)
        .eq("season_id", seasonId)
        .maybeSingle();
      survivorEntry = retry.data;
      survivorEntryError = retry.error;
    }
  }

  if (survivorEntryError || !survivorEntry) {
    console.error("Survivor entry query failed on The Slate.", {
      code: survivorEntryError?.code,
    });
    return { ok: false as const };
  }

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
    return { ok: false as const };
  }
  return {
    ok: true as const,
    entry: survivorEntry as { status: "active" | "eliminated"; eliminated_scoring_period_id: string | null },
    pick: survivorPick,
    usedPicks: usedSurvivorPicks,
  };
}
