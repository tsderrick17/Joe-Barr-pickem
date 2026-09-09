import { gradeBowlPoolPick } from "@/lib/bowl-pool.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function syncBowlPool(now = new Date()) {
  const evaluatedAt = now.toISOString();
  const { data: scheduled, error: scheduleError } = await supabaseAdmin.from("bowl_pool_games").select("id").eq("status", "scheduled").lte("kickoff_at", evaluatedAt);
  if (scheduleError) throw new Error("Bowl Pool kickoff transitions could not be loaded.");
  if (scheduled?.length) {
    const { error } = await supabaseAdmin.from("bowl_pool_games").update({ status: "live" }).in("id", scheduled.map((game) => game.id));
    if (error) throw new Error("Bowl Pool kickoff transitions could not be saved.");
  }
  const { data: missing, error: missingError } = await supabaseAdmin.rpc("settle_bowl_pool_missing_picks", { evaluated_at: evaluatedAt });
  if (missingError) throw new Error("Bowl Pool missing-pick losses could not be settled.");

  const { data: pending, error: pendingError } = await supabaseAdmin.from("bowl_pool_picks").select("id, entry_id, game_id, selected_team_id").eq("result", "pending");
  if (pendingError) throw new Error("Bowl Pool pending picks could not be loaded.");
  const gameIds = [...new Set((pending ?? []).map((pick) => pick.game_id))];
  if (!gameIds.length) return { checkedAt: evaluatedAt, gamesStarted: scheduled?.length ?? 0, missingPickLosses: Number(missing ?? 0), picksGraded: 0 };
  const [{ data: games, error: gamesError }, { data: lines, error: linesError }] = await Promise.all([
    supabaseAdmin.from("bowl_pool_games").select("id, away_team_id, home_team_id, kickoff_at, status, away_score, home_score").in("id", gameIds).eq("status", "final"),
    supabaseAdmin.from("bowl_pool_game_lines").select("game_id, favorite_team_id, locked_spread").in("game_id", gameIds),
  ]);
  if (gamesError || linesError) throw new Error("Bowl Pool final grades could not be prepared.");
  const gameById = new Map((games ?? []).map((game) => [game.id, game]));
  const lineById = new Map((lines ?? []).map((line) => [line.game_id, line]));
  let picksGraded = 0;
  for (const pick of pending ?? []) {
    const game = gameById.get(pick.game_id);
    const line = lineById.get(pick.game_id);
    if (!game || !line || !Number.isInteger(game.away_score) || !Number.isInteger(game.home_score)) continue;
    const result = gradeBowlPoolPick({ selectedTeamId: pick.selected_team_id, favoriteTeamId: line.favorite_team_id, lockedSpread: Number(line.locked_spread), awayTeamId: game.away_team_id, homeTeamId: game.home_team_id, awayScore: game.away_score, homeScore: game.home_score });
    if (result === "pending") continue;
    const { error } = await supabaseAdmin.from("bowl_pool_picks").update({ result, graded_at: evaluatedAt }).eq("id", pick.id).eq("result", "pending");
    if (error) throw new Error("Bowl Pool grades could not be saved.");
    await supabaseAdmin.from("bowl_pool_game_results").upsert({ entry_id: pick.entry_id, game_id: pick.game_id, result, reason: "graded", graded_at: evaluatedAt }, { onConflict: "entry_id,game_id" });
    picksGraded += 1;
  }
  return { checkedAt: evaluatedAt, gamesStarted: scheduled?.length ?? 0, missingPickLosses: Number(missing ?? 0), picksGraded };
}
