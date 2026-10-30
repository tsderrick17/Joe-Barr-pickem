import { supabaseAdmin } from "@/lib/supabase-admin";
import { nextScoreWorkAt } from "@/lib/score-worker-wake.js";
import type { WeekRolloverResult } from "@/lib/advance-scoring-periods";

const NOT_PLAYED = new Set(["postponed", "cancelled", "no_contest"]);

/**
 * After a score run, tell the database gate when the worker next has time-based work (see score-worker-wake.js). Best
 * effort: if this fails, the gate's hourly safety run still wakes the worker, so a failure is only logged.
 */
export async function recordNextScoreWork(weekRollover: WeekRolloverResult | null | undefined, now = new Date()) {
  try {
    const { data: periods, error: periodsError } = await supabaseAdmin
      .from("scoring_periods")
      .select("id, status, period_type, starts_at")
      .in("status", ["active", "upcoming"]);
    if (periodsError) throw periodsError;
    const active = (periods ?? []).find((period) => period.status === "active") ?? null;
    let finalKickoffAt: string | null = null;
    if (active) {
      const { data: games, error: gamesError } = await supabaseAdmin
        .from("games")
        .select("kickoff_at, status")
        .eq("scoring_period_id", active.id);
      if (gamesError) throw gamesError;
      finalKickoffAt = (games ?? []).filter((game) => !NOT_PLAYED.has(game.status)).map((game) => game.kickoff_at).sort().at(-1) ?? null;
    }
    const nextDueAt = nextScoreWorkAt({
      now,
      weekRollover: weekRollover ?? null,
      activePeriod: active ? { periodType: active.period_type, finalKickoffAt } : null,
      upcomingStartsAt: (periods ?? []).filter((period) => period.status === "upcoming").map((period) => period.starts_at),
    });
    const { error } = await supabaseAdmin
      .from("automation_dispatch_state")
      .upsert({ job_name: "scores", next_due_at: nextDueAt, updated_at: now.toISOString() }, { onConflict: "job_name" });
    if (error) throw error;
    return nextDueAt;
  } catch {
    console.error("The score worker's next wake-up time could not be recorded; the hourly safety run will wake it.");
    return null;
  }
}
