import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { buildSeasonSnapshot } from "@/lib/season-snapshot.js";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  const seasonResult = await supabaseAdmin.from("seasons").select("id").eq("year", CURRENT_SEASON_YEAR).maybeSingle();
  if (seasonResult.error || !seasonResult.data) {
    return NextResponse.json({ error: "The current season could not be loaded." }, { status: 503 });
  }

  const [periodsResult, playersResult] = await Promise.all([
    supabaseAdmin.from("scoring_periods").select("id, display_name, display_order, status").eq("season_id", seasonResult.data.id).order("display_order"),
    supabaseAdmin.from("players").select("id").eq("active", true),
  ]);
  if (periodsResult.error || playersResult.error) {
    return NextResponse.json({ error: "The season snapshot could not be loaded." }, { status: 503 });
  }

  const settledIds = (periodsResult.data ?? []).filter((period) => period.status === "complete").map((period) => period.id);
  const picksResult = settledIds.length
    ? await supabaseAdmin.from("picks").select("player_id, scoring_period_id, result").in("scoring_period_id", settledIds)
    : { data: [], error: null };
  if (picksResult.error) {
    return NextResponse.json({ error: "Settled picks could not be loaded." }, { status: 503 });
  }

  const weeks = buildSeasonSnapshot(periodsResult.data ?? [], playersResult.data ?? [], picksResult.data ?? []);
  return NextResponse.json({ weeks }, { headers: { "Cache-Control": "private, no-store" } });
}
