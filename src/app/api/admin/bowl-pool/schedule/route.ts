import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { parseBowlPoolScheduleCsv } from "@/lib/bowl-pool-schedule.js";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try {
    const body = await request.json() as { seasonYear?: number; csv?: string };
    const seasonYear = Number(body.seasonYear);
    if (!Number.isInteger(seasonYear) || !body.csv) return NextResponse.json({ error: "seasonYear and csv are required." }, { status: 400 });
    if (Date.now() >= Date.parse(bowlPoolLaunchAt(seasonYear))) return NextResponse.json({ error: "The schedule is locked after player launch." }, { status: 409 });
    const rows = parseBowlPoolScheduleCsv(body.csv);
    const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").upsert({ season_year: seasonYear, player_visible_at: bowlPoolLaunchAt(seasonYear) }, { onConflict: "season_year" }).select("id").single();
    if (seasonError || !season) throw seasonError ?? new Error("Season could not be created.");
    const payload = rows.map((row) => ({ season_id: season.id, provider_game_id: row.provider_game_id, bowl_name: row.bowl_name, kickoff_at: row.kickoff_at, line_lock_at: row.line_lock_at, order_index: row.order_index, is_cfp: row.is_cfp, status: "scheduled" }));
    const { data: games, error } = await supabaseAdmin.from("bowl_pool_games").upsert(payload, { onConflict: "provider_game_id" }).select("id, provider_game_id, bowl_name, kickoff_at, order_index");
    if (error) throw error;
    return NextResponse.json({ success: true, seasonYear, imported: games?.length ?? 0, games });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Schedule import failed." }, { status: 400 });
  }
}
