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

  // A passed timestamp is not itself worker work. Require a missing official
  // line or a score check that has passed both its normal settlement window and
  // any provider backoff. This matches the Commissioner’s operational health
  // rules and prevents completed games from keeping the public contract red.
  const lineCandidateIds = (dueGames ?? [])
    .filter((game) => new Date(game.line_lock_at).getTime() <= checkedAt.getTime())
    .map((game) => game.id);
  const scoreDueAt = new Date(checkedAt.getTime() - (3 * 60 + 20) * 60 * 1000).getTime();
  const scoreCandidateIds = (dueGames ?? [])
    .filter((game) => new Date(game.kickoff_at).getTime() <= scoreDueAt)
    .map((game) => game.id);
  const [{ data: lockedLines, error: lockedLinesError }, { data: scoreBackoffs, error: scoreBackoffsError }, { data: dueReminders, error: dueRemindersError }] = await Promise.all([
    lineCandidateIds.length
      ? supabaseAdmin.from("game_lines").select("game_id").in("game_id", lineCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    scoreCandidateIds.length
      ? supabaseAdmin.from("score_check_backoff").select("game_id,next_check_at").in("game_id", scoreCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("push_reminders")
      .select("id")
      .in("status", ["scheduled", "sending"])
      .gte("scheduled_for", new Date(checkedAt.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte("scheduled_for", checkedAt.toISOString())
      .limit(1),
  ]);
  if (lockedLinesError) throw lockedLinesError;
  if (scoreBackoffsError) throw scoreBackoffsError;
  if (dueRemindersError) throw dueRemindersError;

  const lockedGameIds = new Set((lockedLines ?? []).map((line) => line.game_id));
  const scoreBackoffByGameId = new Map((scoreBackoffs ?? []).map((backoff) => [backoff.game_id, backoff.next_check_at]));
  const lineLocksDue = lineCandidateIds.some((gameId) => !lockedGameIds.has(gameId));
  const scoresDue = scoreCandidateIds.some((gameId) => {
    const nextCheckAt = scoreBackoffByGameId.get(gameId);
    return !nextCheckAt || new Date(nextCheckAt).getTime() <= checkedAt.getTime();
  });
  const result = assessCriticalWorkerHeartbeats(heartbeats, checkedAt, {
    lineLocksDue,
    scoresDue,
    remindersDue: (dueReminders ?? []).length > 0,
  });
  const problems = result.problems as CriticalWorkerProblem[];
  return { ...result, problems, messages: problems.map(describeCriticalWorkerProblem) };
}
