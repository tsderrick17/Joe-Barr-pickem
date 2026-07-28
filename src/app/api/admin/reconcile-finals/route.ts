import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { reconcileFinalScores } from "@/lib/final-score-reconciliation";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ScoreEvent = { id: string; completed: boolean; scores?: Array<{ name: string; score: string | number | null }> };

function parseScore(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

async function requireCommissioner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return false;
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const { data: player } = await supabaseAdmin.from("players").select("active, is_commissioner").eq("auth_user_id", user.id).maybeSingle();
  return Boolean(player?.active && player.is_commissioner);
}

export async function POST(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const oddsApiKey = process.env.ODDS_API_KEY;
  if (!oddsApiKey) return NextResponse.json({ error: "The NFL score provider is not configured." }, { status: 500 });

  const checkedAt = new Date();
  const cutoff = new Date(checkedAt.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, external_game_id, away_team_id, home_team_id, away_score, home_score")
    .eq("status", "final")
    .gte("finalized_at", cutoff);
  if (gamesError || !games) return NextResponse.json({ error: "Stored final scores could not be loaded." }, { status: 500 });

  const teamIds = [...new Set(games.flatMap((game) => [game.away_team_id, game.home_team_id]))];
  const { data: teams, error: teamsError } = teamIds.length ? await supabaseAdmin.from("teams").select("id, full_name").in("id", teamIds) : { data: [], error: null };
  if (teamsError) return NextResponse.json({ error: "The NFL team list could not be loaded." }, { status: 500 });
  const nameByTeamId = new Map((teams ?? []).map((team) => [team.id, team.full_name]));

  const response = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores/?${new URLSearchParams({ apiKey: oddsApiKey, daysFrom: "3" })}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return NextResponse.json({ error: "The NFL score provider could not be reached right now." }, { status: 502 });
  const providerEvents = ((await response.json()) as ScoreEvent[]).map((event) => {
    const byName = new Map((event.scores ?? []).map((score) => [score.name, parseScore(score.score)]));
    return { id: event.id, completed: event.completed, scores: byName };
  });
  const providerById = new Map(providerEvents.map((event) => [event.id, event]));

  const storedFinals = games.map((game) => {
    const event = providerById.get(game.external_game_id);
    return {
      id: game.id,
      externalGameId: game.external_game_id,
      matchup: `${nameByTeamId.get(game.away_team_id) ?? "Unknown"} at ${nameByTeamId.get(game.home_team_id) ?? "Unknown"}`,
      awayScore: game.away_score,
      homeScore: game.home_score,
      providerEvent: event ? {
        id: event.id,
        completed: event.completed,
        awayScore: event.scores.get(nameByTeamId.get(game.away_team_id) ?? "") ?? null,
        homeScore: event.scores.get(nameByTeamId.get(game.home_team_id) ?? "") ?? null,
      } : null,
    };
  });
  const reconciled = reconcileFinalScores({
    storedFinals: storedFinals.map((game) => ({
      id: game.id,
      externalGameId: game.externalGameId,
      matchup: game.matchup,
      awayScore: game.awayScore,
      homeScore: game.homeScore,
    })),
    providerEvents: storedFinals.flatMap((game) => game.providerEvent ? [game.providerEvent] : []),
  }) as Array<{ state: "match" | "mismatch" | "not_reported" | "provider_not_final" }>;
  const mismatches = reconciled.filter((game) => game.state === "mismatch");
  return NextResponse.json({ checkedAt: checkedAt.toISOString(), checkedGames: reconciled.length, mismatches: mismatches.length, results: reconciled });
}
