import type { ReminderCategory } from "@/lib/reminder-audience";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ReminderReadiness = { ready: boolean; reason: string | null };

function easternDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

async function activePeriod() {
  const { data, error } = await supabaseAdmin
    .from("scoring_periods")
    .select("id")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("The active week could not be checked before sending a reminder.");
  return data;
}

async function hasOfficialLines(gameIds: string[]) {
  if (!gameIds.length) return false;
  const { data, error } = await supabaseAdmin
    .from("game_lines")
    .select("game_id")
    .in("game_id", gameIds);
  if (error) throw new Error("Official lines could not be checked before sending a reminder.");
  return new Set((data ?? []).map((line) => line.game_id)).size === gameIds.length;
}

async function freshSlateReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "The new week is not active yet." };
  const { count, error } = await supabaseAdmin
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("scoring_period_id", period.id);
  if (error) throw new Error("The new Slate could not be checked before sending a reminder.");
  return count && count > 1
    ? { ready: true, reason: null }
    : { ready: false, reason: "The new week does not yet have a full Slate." };
}

async function gameDaySlateReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "There is no active week for today’s Slate." };
  const day = easternDate(new Date());
  const { data: games, error } = await supabaseAdmin
    .from("games")
    .select("id, kickoff_at")
    .eq("scoring_period_id", period.id)
    .not("status", "in", "(postponed,cancelled)");
  if (error) throw new Error("Today’s Slate could not be checked before sending a reminder.");
  const today = (games ?? []).filter((game) => easternDate(new Date(game.kickoff_at)) === day);
  if (!today.length) return { ready: false, reason: "There are no games on today’s Slate." };
  return await hasOfficialLines(today.map((game) => game.id))
    ? { ready: true, reason: null }
    : { ready: false, reason: "Today’s official lines are still being finalized." };
}

async function earlyLockReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "There is no active week for the international-game reminder." };
  const { data: game, error } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("scoring_period_id", period.id)
    .eq("is_international", true)
    .lte("line_lock_at", new Date().toISOString())
    .not("status", "in", "(postponed,cancelled)")
    .order("line_lock_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("The international game could not be checked before sending a reminder.");
  if (!game) return { ready: false, reason: "The international game has not reached its official lock time." };
  return await hasOfficialLines([game.id])
    ? { ready: true, reason: null }
    : { ready: false, reason: "The international official line is still being finalized." };
}

async function recapReady(): Promise<ReminderReadiness> {
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id")
    .eq("status", "complete")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (periodError) throw new Error("The completed week could not be checked before sending a recap.");
  if (!period) return { ready: false, reason: "The completed week has not been finalized yet." };

  const [gamesResult, picksResult, survivorResult] = await Promise.all([
    supabaseAdmin.from("games").select("status").eq("scoring_period_id", period.id),
    supabaseAdmin.from("picks").select("id", { count: "exact", head: true }).eq("scoring_period_id", period.id).eq("result", "pending"),
    supabaseAdmin.from("survivor_picks").select("id", { count: "exact", head: true }).eq("scoring_period_id", period.id).eq("result", "pending"),
  ]);
  if (gamesResult.error || picksResult.error || survivorResult.error) throw new Error("Final grades could not be checked before sending a recap.");
  const gamesFinal = (gamesResult.data ?? []).length > 0 && (gamesResult.data ?? []).every((game) => game.status === "final");
  if (!gamesFinal || (picksResult.count ?? 0) > 0 || (survivorResult.count ?? 0) > 0) {
    return { ready: false, reason: "Final scores and standings are still being settled." };
  }
  return { ready: true, reason: null };
}

export async function reminderReadiness(category: ReminderCategory): Promise<ReminderReadiness> {
  if (category === "weekly") return freshSlateReady();
  if (category === "final_lines") return gameDaySlateReady();
  if (category === "early_lock") return earlyLockReady();
  if (category === "weekly_recap") return recapReady();
  return { ready: true, reason: null };
}
