import { NextRequest, NextResponse } from "next/server";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data: season, error } = await supabaseAdmin.from("bowl_pool_seasons").select("id, season_year, player_visible_at, first_kickoff_at").eq("season_year", CURRENT_SEASON_YEAR).maybeSingle();
  if (error || !season) return NextResponse.json({ error: "Bowl Pool season is not configured." }, { status: 404 });
  const [{ data: games, error: gamesError }, { data: lines }, { data: heartbeats, error: heartbeatError }] = await Promise.all([
    supabaseAdmin.from("bowl_pool_games").select("kickoff_at, away_team_id, home_team_id, status").eq("season_id", season.id).order("kickoff_at"),
    supabaseAdmin.from("bowl_pool_game_lines").select("game_id").in("game_id", (await supabaseAdmin.from("bowl_pool_games").select("id").eq("season_id", season.id)).data?.map((game) => game.id) ?? []),
    supabaseAdmin.from("automation_worker_heartbeats").select("job_name, last_status, last_succeeded_at, updated_at").in("job_name", ["schedule_refresh", "line_locks", "scores"]),
  ]);
  if (gamesError) return NextResponse.json({ error: "Bowl Pool readiness could not be read." }, { status: 500 });
  const future = (games ?? []).filter((game) => new Date(game.kickoff_at).getTime() > Date.now());
  const missingTeams = (games ?? []).filter((game) => !game.away_team_id || !game.home_team_id).length;
  const lockedGames = (games ?? []).filter((game) => game.status !== "scheduled").length;
  return NextResponse.json({ checkedAt: new Date().toISOString(), seasonYear: season.season_year, playerVisibleAt: season.player_visible_at, firstKickoffAt: season.first_kickoff_at, games: games?.length ?? 0, missingTeams, missingLines: Math.max(0, (games ?? []).length - (lines ?? []).length), nextKickoffAt: future[0]?.kickoff_at ?? null, cronHealth: heartbeatError ? "unavailable" : ((heartbeats ?? []).every((row) => row.last_status === "success" || row.last_status === "skipped") ? "healthy" : "attention"), lockedGames });
}
