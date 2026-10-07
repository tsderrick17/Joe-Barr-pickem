import { NextRequest, NextResponse } from "next/server";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";

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
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  const oddsApiKey = process.env.ODDS_API_KEY;

  if (!oddsApiKey) {
    return NextResponse.json(
      { error: "Server configuration is incomplete." },
      { status: 500 },
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
