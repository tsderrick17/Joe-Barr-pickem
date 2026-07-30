import { NextRequest, NextResponse } from "next/server";
import { assessSeasonIntegrity } from "@/lib/integrity-rehearsal";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });

  const [periodsResult, gamesResult, picksResult, survivorPicksResult, linesResult] = await Promise.all([
    supabaseAdmin.from("scoring_periods").select("id, max_picks, status"),
    supabaseAdmin.from("games").select("id, scoring_period_id, away_team_id, home_team_id, status"),
    supabaseAdmin.from("picks").select("player_id, scoring_period_id, game_id, selected_team_id, result"),
    supabaseAdmin.from("survivor_picks").select("survivor_entry_id, scoring_period_id, game_id, selected_team_id, result"),
    supabaseAdmin.from("game_lines").select("game_id"),
  ]);

  if (periodsResult.error || gamesResult.error || picksResult.error || survivorPicksResult.error || linesResult.error) {
    return NextResponse.json({ error: "The integrity rehearsal could not read the current records." }, { status: 500 });
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ...assessSeasonIntegrity({
      periods: periodsResult.data ?? [],
      games: gamesResult.data ?? [],
      picks: picksResult.data ?? [],
      survivorPicks: survivorPicksResult.data ?? [],
      lineGameIds: new Set((linesResult.data ?? []).map((line) => line.game_id)),
    }),
  });
}
