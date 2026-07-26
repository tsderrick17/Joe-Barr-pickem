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

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("first_name, is_commissioner, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    playerError ||
    !player ||
    !player.active ||
    !player.is_commissioner
  ) {
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

  const preview = events.map((event) => {
    const draftKings = event.bookmakers?.find(
      (bookmaker) => bookmaker.key === "draftkings",
    );

    const spreads = draftKings?.markets.find(
      (market) => market.key === "spreads",
    );

    return {
      externalGameId: event.id,
      kickoff: event.commence_time,
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
    games: preview,
    note: "Preview only. Nothing has been added to the pool.",
  });
}