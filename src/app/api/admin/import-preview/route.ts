import { NextRequest, NextResponse } from "next/server";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { seasonYearAt } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getWeekStartKey } from "@/lib/schedule-time.js";

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


export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  const commissioner = access.player;
  const seasonYear = seasonYearAt();
  const oddsApiKey = process.env.ODDS_API_KEY;
  if (!oddsApiKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
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
    .eq("year", seasonYear)
    .maybeSingle();

  if (!season) {
    return NextResponse.json(
      { error: `The ${seasonYear} season has not been set up yet.` },
      { status: 500 },
    );
  }

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, starts_at, ends_at")
    .eq("season_id", season.id)
    .order("display_order");

  if (periodsError || !periods) {
    return NextResponse.json(
      { error: `The ${seasonYear} season weeks could not be loaded.` },
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
      scoringWeek: period?.display_name ?? "Needs review",
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
    commissioner: commissioner.first_name,
    requestsRemaining:
      oddsResponse.headers.get("x-requests-remaining") ?? "unknown",
    games,
    note:
      "Preview only. Existing week assignments are preserved; no games have been added or moved.",
  });
}
