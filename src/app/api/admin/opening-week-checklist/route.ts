import { NextRequest, NextResponse } from "next/server";
import { assessOpeningWeekChecklist } from "@/lib/opening-week-checklist";
import { assessSeasonReadiness } from "@/lib/season-readiness";
import { runLaunchPreflight } from "@/lib/launch-preflight";
import { requireCommissioner } from "@/lib/require-commissioner";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });

  const { data: season, error: seasonError } = await supabaseAdmin
    .from("seasons")
    .select("id, state")
    .eq("year", CURRENT_SEASON_YEAR)
    .maybeSingle();
  if (seasonError || !season) return NextResponse.json({ error: "The current season could not be read for the opening-week checklist." }, { status: 500 });

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name, display_order, status, period_type, max_picks, starts_at")
    .eq("season_id", season.id)
    .order("display_order");
  if (periodsError) return NextResponse.json({ error: "The opening-week checklist could not read scoring periods." }, { status: 500 });

  const periodIds = (periods ?? []).map((period) => period.id);
  const [gamesResult, playersResult, remindersResult, deliveryFailuresResult, automationResult] = await Promise.all([
    periodIds.length ? supabaseAdmin.from("games").select("id, scoring_period_id, gameweek_key, kickoff_at, line_lock_at, away_team_id, home_team_id, status").in("scoring_period_id", periodIds) : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("players").select("id", { count: "exact", head: true }).eq("active", true),
    supabaseAdmin.from("push_reminders").select("id, status, processing_started_at").in("status", ["scheduled", "sending", "failed"]),
    supabaseAdmin.from("email_reminder_deliveries").select("id", { count: "exact", head: true }).in("status", ["failed", "suppressed"]).gte("attempted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    runLaunchPreflight().catch(() => null),
  ]);
  if (gamesResult.error || playersResult.error || remindersResult.error || deliveryFailuresResult.error) return NextResponse.json({ error: "The opening-week checklist could not read the current records." }, { status: 500 });

  const readiness = assessSeasonReadiness({
    seasonState: season.state,
    periods: periods ?? [],
    games: gamesResult.data ?? [],
    reminders: remindersResult.data ?? [],
    emailDeliveryFailures: deliveryFailuresResult.count ?? 0,
  });
  const automationChecks = automationResult?.checks ?? [];
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    automationAvailable: Boolean(automationResult),
    ...assessOpeningWeekChecklist({
      periods: periods ?? [],
      games: gamesResult.data ?? [],
      activePlayerCount: playersResult.count ?? 0,
      automationChecks,
      readinessChecks: readiness.checks,
    }),
  });
}
