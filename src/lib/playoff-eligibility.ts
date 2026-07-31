import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculatePlayoffEligibility } from "./playoff-math.js";

type Player = { id: string };

export async function loadPlayoffEligibility(seasonId: string, targetPeriodId: string, players: Player[]) {
  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_order, period_type, status, max_picks")
    .eq("season_id", seasonId)
    .order("display_order");
  if (periodsError || !periods) throw new Error("Playoff eligibility could not be calculated.");

  const periodIds = periods.map((period) => period.id);
  if (!periodIds.length) return calculatePlayoffEligibility({ players, periods, games: [], picks: [], targetPeriodId });

  const [{ data: games, error: gamesError }, { data: picks, error: picksError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, scoring_period_id, kickoff_at, status").in("scoring_period_id", periodIds),
    supabaseAdmin.from("picks").select("player_id, game_id, result").in("scoring_period_id", periodIds).neq("result", "void"),
  ]);
  if (gamesError || picksError) throw new Error("Playoff eligibility could not be calculated.");

  return calculatePlayoffEligibility({ players, periods, games: games ?? [], picks: picks ?? [], targetPeriodId });
}
