import { NextRequest, NextResponse } from "next/server";
import { assessSeasonReadiness } from "@/lib/season-readiness";
import { requireCommissioner } from "@/lib/require-commissioner";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", CURRENT_SEASON_YEAR)
    .maybeSingle();

  if (seasonError || !season) {
    return NextResponse.json({ error: "The current season could not be read for readiness checks." }, { status: 500 });
  }

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, status, period_type, max_picks")
    .eq("season_id", season.id)
    .order("display_order");

  if (periodsError) {
    return NextResponse.json({ error: "Season-readiness checks could not read the current records." }, { status: 500 });
  }

  const periodIds = (periods ?? []).map((period) => period.id);
  const [gamesResult, remindersResult] = await Promise.all([
    periodIds.length
      ? supabaseAdmin.from("games").select("id, scoring_period_id, kickoff_at, line_lock_at, away_team_id, home_team_id, status").in("scoring_period_id", periodIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("push_reminders").select("id, status, processing_started_at").in("status", ["scheduled", "sending", "failed"]),
  ]);

  if (gamesResult.error || remindersResult.error) {
    return NextResponse.json({ error: "Season-readiness checks could not read the current records." }, { status: 500 });
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ...assessSeasonReadiness({
      periods: periods ?? [],
      games: gamesResult.data ?? [],
      reminders: remindersResult.data ?? [],
    }),
  });
}
