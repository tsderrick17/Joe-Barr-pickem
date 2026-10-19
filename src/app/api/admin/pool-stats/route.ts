import { NextRequest, NextResponse } from "next/server";
import { accessDenied } from "@/lib/access-response";
import { buildGroupStats } from "@/lib/group-stats.js";
import { readAllPages } from "@/lib/read-all-pages";
import { commissionerAccess } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** The group's record, weekly histogram, streaks and splits (Commissioner only). Read-only; every figure comes from graded Pick'em picks. */
export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

  const [players, seasons, periods, games, lines, picks] = await Promise.all([
    supabaseAdmin.from("players").select("id, first_name"),
    supabaseAdmin.from("seasons").select("id, year"),
    supabaseAdmin.from("scoring_periods").select("id, season_id, display_order, period_type, status, max_picks"),
    readAllPages((from, to) => supabaseAdmin.from("games").select("id, home_team_id, away_team_id, home_score, away_score, is_neutral_site").order("id").range(from, to)),
    readAllPages((from, to) => supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread").order("game_id").range(from, to)),
    readAllPages((from, to) => supabaseAdmin.from("picks").select("id, player_id, game_id, scoring_period_id, selected_team_id, result").order("id").range(from, to)),
  ]);
  if ([players, seasons, periods, games, lines, picks].some((read) => read.error)) {
    return NextResponse.json({ error: "The group stats could not be loaded." }, { status: 500 });
  }

  return NextResponse.json(buildGroupStats({
    players: players.data ?? [],
    seasons: seasons.data ?? [],
    periods: periods.data ?? [],
    games: games.data ?? [],
    lines: lines.data ?? [],
    picks: picks.data ?? [],
  }));
}
