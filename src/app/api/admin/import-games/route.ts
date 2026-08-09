import { NextRequest, NextResponse } from "next/server";
import {
  AutomationAlreadyRunningError,
  runWithAutomationLease,
} from "@/lib/automation-execution-lease";
import { requireCommissioner } from "@/lib/require-commissioner";
import { buildScheduleGame } from "@/lib/schedule-game";
import { reconcileFullSeasonSchedule } from "@/lib/full-schedule-reconciliation";
import { getLineLock, getWeekStartKey, getWeekWindow } from "@/lib/schedule-time";
import { seasonYearAt } from "@/lib/season";
import {
  clearScheduleProviderCircuit,
  getScheduleProviderCircuit,
  recordScheduleProviderFailure,
} from "@/lib/schedule-provider-circuit";
import { supabaseAdmin } from "@/lib/supabase-admin";

type OddsOutcome = {
  name: string;
  point: number | null;
};

type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: OddsOutcome[];
    }>;
  }>;
};

type TeamRow = {
  id: string;
  full_name: string;
};

type PeriodRow = {
  id: string;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

type WeekAssignment = {
  weekStartKey: string;
  period: PeriodRow;
  isNew: boolean;
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oddsApiKey = process.env.ODDS_API_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  const isAutomation =
    Boolean(cronSecret) &&
    authorization === `Bearer ${cronSecret}`;

  if (!supabaseUrl || !supabasePublishableKey || !oddsApiKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!isAutomation) {
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in to import games." },
        { status: 401 },
      );
    }

    if (!(await requireCommissioner(request))) {
      return NextResponse.json(
        { error: "Commissioner access is required." },
        { status: 403 },
      );
    }
  }

  try {
    return await runWithAutomationLease("schedule_refresh", () =>
      refreshSchedule({ oddsApiKey, isAutomation }),
    );
  } catch (error) {
    if (error instanceof AutomationAlreadyRunningError) {
      return NextResponse.json(
        isAutomation
          ? { success: true, skipped: true, message: error.message }
          : { error: error.message },
        { status: isAutomation ? 200 : 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The NFL schedule refresh failed." },
      { status: 500 },
    );
  }
}

async function refreshSchedule({
  oddsApiKey,
  isAutomation,
}: {
  oddsApiKey: string;
  isAutomation: boolean;
}) {
  if (isAutomation) {
    const circuit = await getScheduleProviderCircuit();
    if (circuit.blocked) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "provider_cooldown",
        message: "The NFL schedule provider is in automatic cooldown after repeated failures.",
        retryAt: circuit.retryAt,
        consecutiveFailures: circuit.consecutiveFailures,
      });
    }
  }

  const seasonYear = seasonYearAt();
  // The complete schedule provider owns kickoff times after preseason. Its
  // result is intentionally independent of the Odds API, which is only used
  // below for current market snapshots.
  let canonicalSchedule: Awaited<ReturnType<typeof reconcileFullSeasonSchedule>> | null = null;
  let canonicalScheduleWarning: string | null = null;
  try {
    canonicalSchedule = await reconcileFullSeasonSchedule();
  } catch (error) {
    canonicalScheduleWarning = error instanceof Error ? error.message : "The canonical NFL schedule could not be reconciled.";
  }

  let oddsResponse: Response;

  try {
    oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${oddsApiKey}&regions=us&markets=spreads&bookmakers=draftkings`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) },
    );
  } catch (error) {
    const cooldown = await recordScheduleProviderFailure(error);
    return NextResponse.json(
      {
        error: "The NFL odds feed could not be reached right now.",
        retryAt: cooldown.retryAt,
      },
      { status: 502 },
    );
  }

  if (!oddsResponse.ok) {
    const cooldown = await recordScheduleProviderFailure(
      new Error(`The NFL odds feed returned HTTP ${oddsResponse.status}.`),
    );
    return NextResponse.json(
      {
        error: "The NFL odds feed could not be reached right now.",
        retryAt: cooldown.retryAt,
      },
      { status: 502 },
    );
  }

  let events: OddsEvent[];
  try {
    const payload: unknown = await oddsResponse.json();
    if (!Array.isArray(payload)) throw new Error("The NFL odds feed returned an invalid response.");
    events = payload as OddsEvent[];
    await clearScheduleProviderCircuit();
  } catch (error) {
    const cooldown = await recordScheduleProviderFailure(error);
    return NextResponse.json(
      {
        error: "The NFL odds feed returned an invalid response.",
        retryAt: cooldown.retryAt,
      },
      { status: 502 },
    );
  }

  const { data: season } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", seasonYear)
    .maybeSingle();

  if (!season) {
    return NextResponse.json(
      { error: `The ${seasonYear} season has not been set up yet.` },
      { status: 500 },
    );
  }

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, full_name")
    .eq("active", true);

  if (teamsError || !teams) {
    return NextResponse.json(
      { error: "The NFL team list could not be loaded." },
      { status: 500 },
    );
  }

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_order, starts_at, ends_at")
    .eq("season_id", season.id)
    .order("display_order");

  if (periodsError || !periods || periods.length === 0) {
    return NextResponse.json(
      { error: `No scoring periods are configured for ${seasonYear}.` },
      { status: 500 },
    );
  }

  const teamIdByName = new Map(
    (teams as TeamRow[]).map((team) => [
      team.full_name,
      team.id,
    ]),
  );

  const unknownTeams = new Set<string>();

  for (const event of events) {
    if (!teamIdByName.has(event.away_team)) {
      unknownTeams.add(event.away_team);
    }

    if (!teamIdByName.has(event.home_team)) {
      unknownTeams.add(event.home_team);
    }
  }

  if (unknownTeams.size > 0) {
    return NextResponse.json(
      {
        error:
          "Import stopped because these team names do not match the saved NFL team list.",
        teams: [...unknownTeams].sort(),
      },
      { status: 422 },
    );
  }

  const eventsByWeek = new Map<string, OddsEvent[]>();

  for (const event of events) {
    const weekStartKey = getWeekStartKey(
      new Date(event.commence_time),
    );

    const games = eventsByWeek.get(weekStartKey) ?? [];
    games.push(event);
    eventsByWeek.set(weekStartKey, games);
  }

  const groupedWeeks = [...eventsByWeek.entries()].sort(
    ([first], [second]) => first.localeCompare(second),
  );

  const seasonPeriods = periods as PeriodRow[];

  const periodsByWeekStart = new Map<string, PeriodRow>();
  const emptyPeriods: PeriodRow[] = [];

  for (const period of seasonPeriods) {
    if (period.starts_at && period.ends_at) {
      const savedWeekStartKey = getWeekStartKey(
        new Date(period.starts_at),
      );

      periodsByWeekStart.set(savedWeekStartKey, period);
    } else {
      emptyPeriods.push(period);
    }
  }

  const assignments: WeekAssignment[] = [];
  let nextEmptyPeriodIndex = 0;

  for (const [weekStartKey] of groupedWeeks) {
    const savedPeriod = periodsByWeekStart.get(weekStartKey);

    if (savedPeriod) {
      assignments.push({
        weekStartKey,
        period: savedPeriod,
        isNew: false,
      });

      continue;
    }

    const nextEmptyPeriod = emptyPeriods[nextEmptyPeriodIndex];

    if (!nextEmptyPeriod) {
      return NextResponse.json(
        {
          error:
            "Import stopped because there is no unused scoring period available for this schedule group.",
        },
        { status: 409 },
      );
    }

    assignments.push({
      weekStartKey,
      period: nextEmptyPeriod,
      isNew: true,
    });

    nextEmptyPeriodIndex += 1;
  }

  const periodForWeek = new Map(
    assignments.map((assignment) => [
      assignment.weekStartKey,
      assignment.period,
    ]),
  );

  const gamesToUpsert = [];

  for (const event of events) {
    const kickoff = new Date(event.commence_time);
    const weekStartKey = getWeekStartKey(kickoff);
    const period = periodForWeek.get(weekStartKey);

    if (!period) {
      return NextResponse.json(
        {
          error:
            "A schedule group could not be matched to a scoring week.",
        },
        { status: 500 },
      );
    }

    const lineLock = getLineLock(kickoff);

    gamesToUpsert.push(
      buildScheduleGame({
        externalGameId: event.id,
        scoringPeriodId: period.id,
        awayTeamId: teamIdByName.get(event.away_team),
        homeTeamId: teamIdByName.get(event.home_team),
        kickoffAt: event.commence_time,
        lineLockAt: lineLock.lineLockAt,
        isInternational: lineLock.isInternational,
      }),
    );
  }

  const newPeriodAssignments = assignments.filter(
    (assignment) => assignment.isNew,
  );

  const periodAssignments = newPeriodAssignments.map((assignment) => {
    const window = getWeekWindow(assignment.weekStartKey);
    return {
      scoring_period_id: assignment.period.id,
      starts_at: window.startsAt,
      ends_at: window.endsAt,
    };
  });

  const preliminarySpreads = events.flatMap((event) => {
    const draftKings = event.bookmakers?.find(
      (bookmaker) => bookmaker.key === "draftkings",
    );

    const spreadMarket = draftKings?.markets.find(
      (market) => market.key === "spreads",
    );

    const favorite = spreadMarket?.outcomes.find(
      (outcome) =>
        outcome.point !== null && outcome.point < 0,
    );

    const favoriteTeamId = favorite
      ? teamIdByName.get(favorite.name)
      : null;

    if (!favorite || !favoriteTeamId) {
      return [];
    }

    return [
      {
        external_game_id: event.id,
        favorite_team_id: favoriteTeamId,
        spread: Math.abs(favorite.point ?? 0),
        source: "DraftKings",
      },
    ];
  });

  const { data: importRows, error: importError } = await supabaseAdmin.rpc(
    "import_schedule_atomically",
    {
      target_season_id: season.id,
      period_assignments: periodAssignments,
      schedule_games: gamesToUpsert,
      preliminary_spreads: preliminarySpreads,
    },
  );

  if (importError || !importRows?.[0]) {
    const requiresReview = importError?.message.includes(
      "Schedule review required",
    );
    return NextResponse.json(
      {
        error: requiresReview
          ? "A saved game changed after its line locked, after settlement, or across scoring weeks. Nothing was changed; review that game before continuing."
          : "The schedule import could not be completed safely. No changes were saved.",
      },
      { status: requiresReview ? 409 : 500 },
    );
  }

  const importResult = importRows[0] as {
    games_saved: number;
    preliminary_spreads_saved: number;
    new_weeks_assigned: number;
  };

  return NextResponse.json({
    message:
      "Schedule and preliminary spread refresh completed as one protected operation. New games were added; any pre-lock kickoff correction reopened only that game's official line.",
    importedGames: importResult.games_saved,
    preliminarySpreadsSaved: importResult.preliminary_spreads_saved,
    newWeeksAssigned: importResult.new_weeks_assigned,
    requestsRemaining:
      oddsResponse.headers.get("x-requests-remaining") ??
      "unknown",
    canonicalSchedule,
    canonicalScheduleWarning,
  });
}
