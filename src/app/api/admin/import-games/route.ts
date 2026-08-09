import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { buildScheduleGame } from "@/lib/schedule-game";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
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

const easternTimeZone = "America/New_York";

function getEasternParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: easternTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
  };
}

function getEasternOffsetMilliseconds(date: Date) {
  const eastern = getEasternParts(date);

  const easternClockReadAsUtc = Date.UTC(
    eastern.year,
    eastern.month - 1,
    eastern.day,
    eastern.hour,
  );

  return easternClockReadAsUtc - date.getTime();
}

function easternDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour));
  const offset = getEasternOffsetMilliseconds(utcGuess);

  return new Date(utcGuess.getTime() - offset);
}

function getWeekStartKey(kickoff: Date) {
  const eastern = getEasternParts(kickoff);
  const date = new Date(
    Date.UTC(eastern.year, eastern.month - 1, eastern.day),
  );

  const daysSinceTuesday = (date.getUTCDay() - 2 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceTuesday);

  return date.toISOString().slice(0, 10);
}

function getWeekWindow(weekStartKey: string) {
  const [year, month, day] = weekStartKey.split("-").map(Number);

  const start = easternDateTimeToUtc(year, month, day, 0);

  const nextTuesday = new Date(Date.UTC(year, month - 1, day));
  nextTuesday.setUTCDate(nextTuesday.getUTCDate() + 7);

  const end = easternDateTimeToUtc(
    nextTuesday.getUTCFullYear(),
    nextTuesday.getUTCMonth() + 1,
    nextTuesday.getUTCDate(),
    0,
  );

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

function getLineLock(kickoff: Date) {
  const eastern = getEasternParts(kickoff);
  // The provider does not expose venue country. NFL international games are
  // the Sunday morning ET window; retaining this narrow rule avoids treating
  // ordinary early domestic kickoffs as international exceptions.
  const isEarlyInternationalGame =
    eastern.weekday === "Sun" && eastern.hour < 12;

  if (isEarlyInternationalGame) {
    const priorDay = new Date(
      Date.UTC(eastern.year, eastern.month - 1, eastern.day),
    );

    priorDay.setUTCDate(priorDay.getUTCDate() - 1);

    return {
      isInternational: true,
      lineLockAt: easternDateTimeToUtc(
        priorDay.getUTCFullYear(),
        priorDay.getUTCMonth() + 1,
        priorDay.getUTCDate(),
        18,
      ).toISOString(),
    };
  }

  return {
    isInternational: false,
    lineLockAt: easternDateTimeToUtc(
      eastern.year,
      eastern.month,
      eastern.day,
      8,
    ).toISOString(),
  };
}

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

  let oddsResponse: Response;

  try {
    oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${oddsApiKey}&regions=us&markets=spreads&bookmakers=draftkings`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) },
    );
  } catch {
    return NextResponse.json(
      { error: "The NFL odds feed could not be reached right now." },
      { status: 502 },
    );
  }

  if (!oddsResponse.ok) {
    return NextResponse.json(
      { error: "The NFL odds feed could not be reached right now." },
      { status: 502 },
    );
  }

  const events = (await oddsResponse.json()) as OddsEvent[];

  const { data: season } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", CURRENT_SEASON_YEAR)
    .maybeSingle();

  if (!season) {
    return NextResponse.json(
      { error: `The ${CURRENT_SEASON_YEAR} season has not been set up yet.` },
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
      { error: `No scoring periods are configured for ${CURRENT_SEASON_YEAR}.` },
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
  });
}
