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

type PeriodRow = {
  id: string;
  display_name: string;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

const easternTimeZone = "America/New_York";

function getEasternParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: easternTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
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

export async function GET(request: NextRequest) {
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
      { error: "You must be signed in to use this page." },
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

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, starts_at, ends_at")
    .eq("season_id", season.id)
    .eq("period_type", "regular")
    .order("display_order");

  if (periodsError || !periods) {
    return NextResponse.json(
      { error: "The 2026 pool weeks could not be loaded." },
      { status: 500 },
    );
  }

  const savedWeekMap = new Map<string, PeriodRow>();
  const emptyPeriods: PeriodRow[] = [];

  for (const period of periods as PeriodRow[]) {
    if (period.starts_at && period.ends_at) {
      savedWeekMap.set(
        getWeekStartKey(new Date(period.starts_at)),
        period,
      );
    } else {
      emptyPeriods.push(period);
    }
  }

  const newWeekMap = new Map<string, PeriodRow>();
  let nextEmptyPeriod = 0;

  const sortedWeekKeys = [...new Set(
    events.map((event) => getWeekStartKey(new Date(event.commence_time))),
  )].sort();

  for (const weekStartKey of sortedWeekKeys) {
    if (savedWeekMap.has(weekStartKey)) {
      continue;
    }

    const period = emptyPeriods[nextEmptyPeriod];

    if (period) {
      newWeekMap.set(weekStartKey, period);
      nextEmptyPeriod += 1;
    }
  }

  const games = events.map((event) => {
    const weekStartKey = getWeekStartKey(new Date(event.commence_time));
    const period =
      savedWeekMap.get(weekStartKey) ?? newWeekMap.get(weekStartKey);

    const draftKings = event.bookmakers?.find(
      (bookmaker) => bookmaker.key === "draftkings",
    );

    const spreads = draftKings?.markets.find(
      (market) => market.key === "spreads",
    );

    return {
      externalGameId: event.id,
      kickoff: event.commence_time,
      poolWeek: period?.display_name ?? "Needs review",
      awayTeam: event.away_team,
      homeTeam: event.home_team,
      spread:
        spreads?.outcomes.map((outcome) => ({
          team: outcome.name,
          point: outcome.point,
        })) ?? [],
    };
  });

  return NextResponse.json({
    commissioner: player.first_name,
    requestsRemaining:
      oddsResponse.headers.get("x-requests-remaining") ?? "unknown",
    games,
    note:
      "Preview only. Existing week assignments are preserved; no games have been added or moved.",
  });
}