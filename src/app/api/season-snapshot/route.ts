import { NextRequest, NextResponse } from "next/server";
import { authenticatedProfilePlayer } from "@/lib/authenticated-profile-player";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentSeasonYear } from "@/lib/season";
import { buildSeasonSnapshot, seasonSnapshotReleased } from "@/lib/season-snapshot.js";

export async function GET(request: NextRequest) {
  const viewer = await authenticatedProfilePlayer(request);
  if (!viewer) return NextResponse.json({ error: "Your sign-in session could not be verified." }, { status: 401 });

  const seasonResult = await supabaseAdmin.from("seasons").select("id").eq("year", currentSeasonYear()).maybeSingle();
  if (seasonResult.error || !seasonResult.data) {
    return NextResponse.json({ error: "The current season could not be loaded." }, { status: 503 });
  }

  const [periodsResult, playersResult, colorOrderResult] = await Promise.all([
    supabaseAdmin.from("scoring_periods").select("id, display_name, display_order, status, period_type, max_picks").eq("season_id", seasonResult.data.id).order("display_order"),
    supabaseAdmin.from("players").select("id").eq("active", true),
    // Colors follow join order across every player ever added, so a new or
    // inactive player never changes anyone else's color.
    supabaseAdmin.from("players").select("id").order("created_at").order("id"),
  ]);
  if (periodsResult.error || playersResult.error || colorOrderResult.error) {
    return NextResponse.json({ error: "The season snapshot could not be loaded." }, { status: 503 });
  }

  // Commissioners can always preview; players see it from Week 6 of this season.
  if (!viewer.is_commissioner && !seasonSnapshotReleased(periodsResult.data ?? [])) {
    return NextResponse.json({ error: "The Season Snapshot opens in Week 6." }, { status: 403 });
  }

  const visibleIds = (periodsResult.data ?? []).filter((period) => period.status === "complete" || period.status === "active").map((period) => period.id);
  const activeIds = (periodsResult.data ?? []).filter((period) => period.status === "active").map((period) => period.id);
  const [picksResult, activeGamesResult] = await Promise.all([
    visibleIds.length
      ? supabaseAdmin.from("picks").select("player_id, scoring_period_id, result").in("scoring_period_id", visibleIds)
      : Promise.resolve({ data: [], error: null }),
    activeIds.length
      ? supabaseAdmin.from("games").select("scoring_period_id, kickoff_at").in("scoring_period_id", activeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (picksResult.error || activeGamesResult.error) {
    return NextResponse.json({ error: "Graded picks could not be loaded." }, { status: 503 });
  }

  // The active week is plotted for everyone at once, after its last pick settles.
  const now = Date.now();
  const activeWeekSettled = new Set(activeIds.filter((periodId) => {
    const games = (activeGamesResult.data ?? []).filter((game) => game.scoring_period_id === periodId);
    const allKickedOff = games.length > 0 && games.every((game) => new Date(game.kickoff_at).getTime() <= now);
    const nothingPending = !(picksResult.data ?? []).some((pick) => pick.scoring_period_id === periodId && pick.result === "pending");
    return allKickedOff && nothingPending;
  }));
  const snapshot = buildSeasonSnapshot(periodsResult.data ?? [], playersResult.data ?? [], picksResult.data ?? [], activeWeekSettled);
  return NextResponse.json({ ...snapshot, colorOrder: (colorOrderResult.data ?? []).map((player) => player.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
