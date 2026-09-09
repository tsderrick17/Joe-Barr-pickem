import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assessBowlPoolIntegrity } from "@/lib/bowl-pool-integrity";
import { assessBowlPoolSettlement } from "@/lib/bowl-pool-reconciliation.js";

export async function checkBowlPoolHealth() {
  const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", CURRENT_SEASON_YEAR).maybeSingle();
  if (seasonError) throw seasonError;
  if (!season) return { configured: false, healthy: true, problems: [], integrity: null, settlement: null };
  const { data: games, error: gamesError } = await supabaseAdmin.from("bowl_pool_games").select("id,kickoff_at,order_index,status,away_team_id,home_team_id").eq("season_id", season.id).order("kickoff_at");
  if (gamesError) throw gamesError;
  const gameIds = (games ?? []).map((game) => game.id);
  const { data: entries, error: entriesError } = await supabaseAdmin.from("bowl_pool_entries").select("id,status").eq("season_id", season.id);
  if (entriesError) throw entriesError;
  const entryIds = (entries ?? []).map((entry) => entry.id);
  const [linesResult, picksResult, resultsResult] = await Promise.all([
    gameIds.length ? supabaseAdmin.from("bowl_pool_game_lines").select("game_id").in("game_id", gameIds) : Promise.resolve({ data: [], error: null }),
    entryIds.length ? supabaseAdmin.from("bowl_pool_picks").select("entry_id,game_id,result").in("entry_id", entryIds) : Promise.resolve({ data: [], error: null }),
    gameIds.length ? supabaseAdmin.from("bowl_pool_game_results").select("entry_id,game_id,result").in("game_id", gameIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (linesResult.error || picksResult.error || resultsResult.error) throw linesResult.error ?? picksResult.error ?? resultsResult.error;
  const integrity = assessBowlPoolIntegrity(games ?? [], linesResult.data ?? []);
  const settlement = assessBowlPoolSettlement({ games: games ?? [], entries: entries ?? [], picks: picksResult.data ?? [], results: resultsResult.data ?? [], lines: linesResult.data ?? [] });
  return { configured: true, healthy: integrity.healthy && settlement.healthy, problems: [...integrity.problems, ...settlement.problems], integrity, settlement };
}
