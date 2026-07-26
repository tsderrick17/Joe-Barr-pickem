import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
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
  const isEarlyInternationalGame = eastern.hour < 12;

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
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !supabasePublishableKey || !oddsApiKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "You must be signed in to import games." },
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
      { error: "Your sign-in session could not be verified." },
      { status: 401 },
    );
  }

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("first_name, is_commissioner, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!player || !player.active || !player.is_commissioner) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  const oddsResponse = await fetch(
    `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${oddsApiKey}&regions=us&markets=spreads&bookmakers=draftkings`,
    { cache: "no-store" },
  );

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
    .eq("year", 2026)
    .maybeSingle();

  if (!season) {
    return NextResponse.json(
      { error: "The 2026 season has not been set up yet." },
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
    .eq("period_type", "regular")
    .order("display_order");

  if (periodsError || !periods || periods.length === 0) {
    return NextResponse.json(
      { error: "No regular-season weeks are configured for 2026." },
      { status: 500 },
    );
  }

  const teamIdByName = new Map(
    (teams as TeamRow[]).map((team) => [team.full_name, team.id]),
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
    const weekStartKey = getWeekStartKey(new Date(event.commence_time));
    const games = eventsByWeek.get(weekStartKey) ?? [];
    games.push(event);
    eventsByWeek.set(weekStartKey, games);
  }

  const groupedWeeks = [...eventsByWeek.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );

  const regularPeriods = periods as PeriodRow[];

  const periodsByWeekStart = new Map<string, PeriodRow>();
  const emptyPeriods: PeriodRow[] = [];

  for (const period of regularPeriods) {
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
            "Import stopped because there is no unused regular-season week available for this schedule group.",
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

  const externalGameIds = events.map((event) => event.id);

  const { data: existingGames, error: existingGamesError } =
    await supabaseAdmin
      .from("games")
      .select("external_game_id")
      .in("external_game_id", externalGameIds);

  if (existingGamesError) {
    return NextResponse.json(
      { error: "Existing games could not be checked." },
      { status: 500 },
    );
  }

  const existingExternalGameIds = new Set(
    existingGames?.map((game) => game.external_game_id) ?? [],
  );

  const gamesToUpsert = [];

  for (const event of events) {
    const kickoff = new Date(event.commence_time);
    const weekStartKey = getWeekStartKey(kickoff);
    const period = periodForWeek.get(weekStartKey);

    if (!period) {
      return NextResponse.json(
        { error: "A schedule group could not be matched to a pool week." },
        { status: 500 },
      );
    }

    const lineLock = getLineLock(kickoff);

    gamesToUpsert.push({
      external_game_id: event.id,
      scoring_period_id: period.id,
      away_team_id: teamIdByName.get(event.away_team),
      home_team_id: teamIdByName.get(event.home_team),
      kickoff_at: event.commence_time,
      line_lock_at: lineLock.lineLockAt,
      is_international: lineLock.isInternational,
      status: "scheduled",
    });
  }

  const { data: savedGames, error: gameError } = await supabaseAdmin
    .from("games")
    .upsert(gamesToUpsert, { onConflict: "external_game_id" })
    .select("id, external_game_id");

  if (gameError || !savedGames) {
    return NextResponse.json(
      {
        error:
          "The games could not be saved. Existing week assignments remain protected.",
      },
      { status: 500 },
    );
  }

  const newPeriodAssignments = assignments.filter(
    (assignment) => assignment.isNew,
  );

  for (const assignment of newPeriodAssignments) {
    const window = getWeekWindow(assignment.weekStartKey);

    const { error: periodDateError } = await supabaseAdmin
      .from("scoring_periods")
      .update({
        starts_at: window.startsAt,
        ends_at: window.endsAt,
      })
      .eq("id", assignment.period.id);

    if (periodDateError) {
      return NextResponse.json(
        {
          error:
            "Games were saved, but a new scoring period could not be dated.",
        },
        { status: 500 },
      );
    }
  }

  const gameIdByExternalId = new Map(
    savedGames.map((game) => [game.external_game_id, game.id]),
  );

  const spreadHistoryRows = events.flatMap((event) => {
    if (existingExternalGameIds.has(event.id)) {
      return [];
    }

    const draftKings = event.bookmakers?.find(
      (bookmaker) => bookmaker.key === "draftkings",
    );

    const spreadMarket = draftKings?.markets.find(
      (market) => market.key === "spreads",
    );

    const favorite = spreadMarket?.outcomes.find(
      (outcome) => outcome.point !== null && outcome.point < 0,
    );

    if (!favorite) {
      return [];
    }

    return [
      {
        game_id: gameIdByExternalId.get(event.id),
        favorite_team_id: teamIdByName.get(favorite.name),
        spread: Math.abs(favorite.point ?? 0),
        source: "DraftKings",
      },
    ];
  });

  if (spreadHistoryRows.length > 0) {
    const { error: spreadError } = await supabaseAdmin
      .from("spread_history")
      .insert(spreadHistoryRows);

    if (spreadError) {
      return NextResponse.json(
        {
          error:
            "Games were saved, but preliminary spread history could not be saved.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message:
      "Schedule import completed. Existing week assignments were preserved and no official lines were locked.",
    importedGames: savedGames.length,
    preliminarySpreadsSaved: spreadHistoryRows.length,
    newWeeksAssigned: newPeriodAssignments.length,
    requestsRemaining:
      oddsResponse.headers.get("x-requests-remaining") ?? "unknown",
  });
}