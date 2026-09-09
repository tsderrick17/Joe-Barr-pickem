import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function seasonGames() {
  const year = new Date().getUTCMonth() >= 7 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const { data: season } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", year).maybeSingle();
  if (!season) return [];
  const { data: games, error } = await supabaseAdmin.from("bowl_pool_games").select("id, bowl_name, kickoff_at, status, away_team_id, home_team_id").eq("season_id", season.id).order("kickoff_at");
  if (error || !games) throw new Error("Bowl Pool exceptions could not be loaded.");
  const teamIds = [...new Set(games.flatMap((game) => [game.away_team_id, game.home_team_id]).filter(Boolean))];
  const { data: teams, error: teamError } = teamIds.length ? await supabaseAdmin.from("bowl_pool_teams").select("id, display_name").in("id", teamIds) : { data: [], error: null };
  if (teamError) throw new Error("Bowl Pool team details could not be loaded.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.display_name]));
  return games.map((game) => ({ id: game.id, bowlName: game.bowl_name, kickoffAt: game.kickoff_at, status: game.status, awayTeam: names.get(game.away_team_id) ?? "Team TBD", homeTeam: names.get(game.home_team_id) ?? "Team TBD" }));
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try {
    const games = await seasonGames();
    return NextResponse.json({ recordableGames: games.filter((game) => game.status === "scheduled" || game.status === "live"), exceptions: games.filter((game) => game.status === "postponed" || game.status === "cancelled" || game.status === "no_contest") });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bowl Pool exceptions could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const commissioner = await requireCommissioner(request);
  if (!commissioner) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  let body: { gameId?: string; status?: "postponed" | "cancelled" | "no_contest" };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The Bowl Pool disruption record was incomplete." }, { status: 400 }); }
  if (!body.gameId || !["postponed", "cancelled", "no_contest"].includes(body.status ?? "")) return NextResponse.json({ error: "Choose a Bowl Pool game and a valid disruption status." }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("record_bowl_game_disruption", { target_game_id: body.gameId, disruption_status: body.status, actor_player_id: commissioner.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const voided = Number(data?.[0]?.picks_voided ?? 0);
  return NextResponse.json({ message: `${body.status === "no_contest" ? "No contest" : body.status === "cancelled" ? "Cancellation" : "Postponement"} recorded. ${voided} Bowl Pool pick${voided === 1 ? "" : "s"} voided.` });
}
