import { assessCriticalWorkerHeartbeats, describeCriticalWorkerProblem } from "@/lib/critical-worker-heartbeat.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type CriticalWorkerProblem = {
  jobName: "line_locks" | "scores" | "reminders";
  reason: "missing" | "invalid" | "failed" | "stale";
};

/**
 * Shared by the public smoke contract and the Commissioner desk. Public callers
 * deliberately receive only the boolean result; the Commissioner view receives
 * these safe, operational descriptions.
 */
export async function checkCriticalWorkerHealth(checkedAt = new Date()) {
  const [{ data: heartbeats, error: heartbeatsError }, { data: activePeriods, error: activePeriodsError }] = await Promise.all([
    supabaseAdmin
      .from("automation_worker_heartbeats")
      .select("job_name,last_succeeded_at,last_failed_at")
      .in("job_name", ["line_locks", "scores", "reminders"]),
    supabaseAdmin
      .from("scoring_periods")
      .select("id, starts_at, ends_at")
      .eq("status", "active"),
  ]);
  if (heartbeatsError) throw heartbeatsError;
  if (activePeriodsError) throw activePeriodsError;

  const activePeriodIds = (activePeriods ?? [])
    .filter((period) => {
      const startsAt = period.starts_at ? new Date(period.starts_at).getTime() : Number.NEGATIVE_INFINITY;
      const endsAt = period.ends_at ? new Date(period.ends_at).getTime() : Number.POSITIVE_INFINITY;
      return startsAt <= checkedAt.getTime() && endsAt >= checkedAt.getTime();
    })
    .map((period) => period.id);
  const { data: dueGames, error: dueGamesError } = activePeriodIds.length === 0
    ? { data: [], error: null }
    : await supabaseAdmin
      .from("games")
      .select("id, kickoff_at, line_lock_at, status")
      .in("scoring_period_id", activePeriodIds)
      .in("status", ["scheduled", "live"]);
  if (dueGamesError) throw dueGamesError;

  const { data: dueReminders, error: dueRemindersError } = await supabaseAdmin
    .from("push_reminders")
    .select("id")
    .in("status", ["scheduled", "sending"])
    .gte("scheduled_for", new Date(checkedAt.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .lte("scheduled_for", checkedAt.toISOString())
    .limit(1);
  if (dueRemindersError) throw dueRemindersError;

  const lineLocksDue = (dueGames ?? []).some((game) => new Date(game.line_lock_at).getTime() <= checkedAt.getTime());
  const scoresDue = (dueGames ?? []).some((game) => new Date(game.kickoff_at).getTime() <= checkedAt.getTime());
  const result = assessCriticalWorkerHeartbeats(heartbeats, checkedAt, {
    lineLocksDue,
    scoresDue,
    remindersDue: (dueReminders ?? []).length > 0,
  });
  const problems = result.problems as CriticalWorkerProblem[];
  return { ...result, problems, messages: problems.map(describeCriticalWorkerProblem) };
}
