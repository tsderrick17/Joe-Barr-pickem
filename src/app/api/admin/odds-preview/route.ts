import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";

type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    markets?: Array<{
      key: string;
      outcomes?: Array<{
        name: string;
        point?: number;
      }>;
    }>;
  }>;
};

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oddsApiKey = process.env.ODDS_API_KEY;

  if (!supabaseUrl || !supabasePublishableKey || !oddsApiKey) {
    return NextResponse.json(
      { error: "Server configuration is incomplete." },
      { status: 500 },
    );
  }

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Sign in is required." },
      { status: 401 },
    );
  }

  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  const query = new URLSearchParams({
    apiKey: oddsApiKey,
    regions: "us",
    markets: "spreads",
    oddsFormat: "american",
  });

  let response: Response;

  try {
    response = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?${query}`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) },
    );
  } catch {
    return NextResponse.json(
      { error: "The odds provider could not be reached." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "The odds provider could not be reached." },
      { status: 502 },
    );
  }

  const events = (await response.json()) as OddsApiEvent[];

  return NextResponse.json({
    requestsRemaining: response.headers.get("x-requests-remaining"),
    events: events.map((event) => ({
      id: event.id,
      kickoffAt: event.commence_time,
      awayTeam: event.away_team,
      homeTeam: event.home_team,
      bookmakerSpreads:
        event.bookmakers?.map((bookmaker) => {
          const spreadMarket = bookmaker.markets?.find(
            (market) => market.key === "spreads",
          );

          return {
            source: bookmaker.title,
            outcomes:
              spreadMarket?.outcomes?.map((outcome) => ({
                team: outcome.name,
                spread: outcome.point ?? null,
              })) ?? [],
          };
        }) ?? [],
    })),
  });
}
