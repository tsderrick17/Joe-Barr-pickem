import { checkReminderHealth } from "@/lib/reminder-health";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AutomationRun = {
  job_type: "line_locks" | "scores";
  status: "started" | "success" | "failed";
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  details: { requestsRemaining?: string | null; quotaProtected?: boolean } | null;
};

function latestByJob(runs: AutomationRun[], job: AutomationRun["job_type"]) {
  return runs.find((run) => run.job_type === job) ?? null;
}

export async function checkAutomationHealth(now = new Date()) {
  const checkedAt = now.toISOString();
  const scoreDueAt = new Date(now.getTime() - (3 * 60 + 20) * 60 * 1000).toISOString();
  const lineHealthDueAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const [runsResult, lineCandidatesResult, scoreGamesResult, reminderHealth, scheduleReviewsResult, scheduleCircuitResult] = await Promise.all([
    supabaseAdmin
      .from("sync_runs")
      .select("job_type, status, started_at, completed_at, error_message, details")
      .in("job_type", ["line_locks", "scores"])
      .order("started_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("games")
      .select("id")
      .in("status", ["scheduled", "live"])
      .lte("line_lock_at", lineHealthDueAt),
    supabaseAdmin
      .from("games")
      .select("id")
      .in("status", ["scheduled", "live"])
      .lte("kickoff_at", scoreDueAt),
    checkReminderHealth(now),
    supabaseAdmin.from("schedule_change_reviews").select("id", { count: "exact", head: true }).is("resolved_at", null),
    supabaseAdmin.from("provider_failure_circuits")
      .select("consecutive_failures, next_retry_at, last_error")
      .eq("provider_job", "schedule_refresh").maybeSingle(),
  ]);

  if (
    runsResult.error || lineCandidatesResult.error || scoreGamesResult.error ||
    scheduleReviewsResult.error || scheduleCircuitResult.error
  ) {
    throw new Error("Automation health could not be prepared.");
  }

  const lineCandidateIds = (lineCandidatesResult.data ?? []).map((game) => game.id);
  const scoreCandidateIds = (scoreGamesResult.data ?? []).map((game) => game.id);
  const retentionCutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const [linesResult, scoreBackoffsResult, oldSyncRunsResult, oldEmailDeliveriesResult, oldPushDeliveriesResult] = await Promise.all([
    lineCandidateIds.length
      ? supabaseAdmin.from("game_lines").select("game_id").in("game_id", lineCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    scoreCandidateIds.length
      ? supabaseAdmin.from("score_check_backoff").select("game_id, attempts, next_check_at").in("game_id", scoreCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("sync_runs").select("id", { count: "exact", head: true }).lt("started_at", retentionCutoff),
    supabaseAdmin.from("email_reminder_deliveries").select("id", { count: "exact", head: true }).lt("created_at", retentionCutoff),
    supabaseAdmin.from("push_reminder_deliveries").select("id", { count: "exact", head: true }).lt("created_at", retentionCutoff),
  ]);

  if (
    linesResult.error || scoreBackoffsResult.error || oldSyncRunsResult.error ||
    oldEmailDeliveriesResult.error || oldPushDeliveriesResult.error
  ) {
    throw new Error("Automation health could not inspect operational retention.");
  }

  const runs = (runsResult.data ?? []) as AutomationRun[];
  const latestLocks = latestByJob(runs, "line_locks");
  const latestScores = latestByJob(runs, "scores");
  const latestSuccessfulLocks = runs.find((run) => run.job_type === "line_locks" && run.status === "success") ?? null;
  const latestSuccessfulScores = runs.find((run) => run.job_type === "scores" && run.status === "success") ?? null;
  const providerRemainingRaw = latestSuccessfulScores?.details?.requestsRemaining;
  const providerAllowance =
    typeof providerRemainingRaw === "string" && /^\d+$/.test(providerRemainingRaw)
      ? Number(providerRemainingRaw)
      : null;
  const lockedIds = new Set((linesResult.data ?? []).map((line) => line.game_id));
  const missingOfficialLines = lineCandidateIds.filter((id) => !lockedIds.has(id)).length;
  const scoreCandidates = scoreCandidateIds.length;
  const backoffByGame = new Map(
    (scoreBackoffsResult.data ?? []).map((backoff) => [backoff.game_id, backoff.next_check_at]),
  );
  // A newly overdue game has no backoff row yet. Treat it as due immediately
  // so a failed score worker cannot hide behind the cooldown safeguard.
  const scoreChecksDueNow = scoreCandidateIds.filter((gameId) => {
    const nextCheckAt = backoffByGame.get(gameId);
    return !nextCheckAt || new Date(nextCheckAt).getTime() <= now.getTime();
  }).length;
  const scoreProviderFailureStreak = latestScores?.status === "failed"
    ? Math.max(0, ...(scoreBackoffsResult.data ?? []).map((backoff) => backoff.attempts))
    : 0;
  const scoreRetryTimes = (scoreBackoffsResult.data ?? [])
    .map((backoff) => backoff.next_check_at)
    .filter(Boolean)
    .sort();
  const problems: string[] = [];

  if (latestLocks?.status === "failed" && missingOfficialLines > 0) {
    problems.push("The most recent official-line lock failed while a game needs an official line.");
  }
  if (latestScores?.status === "failed" && scoreChecksDueNow > 0) {
    problems.push("The most recent final-score sync failed while games are awaiting review.");
  }
  if (missingOfficialLines > 0) {
    problems.push(`${missingOfficialLines} game${missingOfficialLines === 1 ? " is" : "s are"} past line lock without an official line.`);
  }

  const quotaProtected = latestSuccessfulScores?.details?.quotaProtected === true ||
    (providerAllowance !== null && providerAllowance < 25);
  const latestScoreFinishedAt = latestScores
    ? new Date(latestScores.completed_at ?? latestScores.started_at).getTime()
    : 0;
  if (
    scoreChecksDueNow > 0 &&
    !quotaProtected &&
    (!latestScores || latestScores.status !== "success" || now.getTime() - latestScoreFinishedAt > 30 * 60 * 1000)
  ) {
    problems.push("Final-score sync is stale while games are awaiting review.");
  }
  if (quotaProtected) {
    problems.push(`Odds API allowance is being protected${providerAllowance !== null ? ` (${providerAllowance} credits reported)` : ""}; delayed final-score polling is in cooldown.`);
  }
  const pendingScheduleReviews = scheduleReviewsResult.count ?? 0;
  if (pendingScheduleReviews > 0) {
    problems.push(`${pendingScheduleReviews} provider schedule change${pendingScheduleReviews === 1 ? " needs" : "s need"} commissioner review.`);
  }

  const retention = {
    cutoff: retentionCutoff,
    syncRuns: oldSyncRunsResult.count ?? 0,
    emailDeliveries: oldEmailDeliveriesResult.count ?? 0,
    pushDeliveries: oldPushDeliveriesResult.count ?? 0,
  };
  const retentionCandidates = retention.syncRuns + retention.emailDeliveries + retention.pushDeliveries;
  if (retentionCandidates > 20_000) {
    problems.push(`${retentionCandidates.toLocaleString()} operational records are older than 180 days; review archival storage before the database grows further.`);
  }

  problems.push(...reminderHealth.problems);
  return {
    checkedAt,
    status: problems.length ? ("attention" as const) : ("healthy" as const),
    problems,
    latestLocks,
    latestScores,
    latestSuccessfulLocks,
    latestSuccessfulScores,
    missingOfficialLines,
    scoreCandidates,
    scoreChecksDueNow,
    scoreProviderFailureStreak,
    scoreProviderRetryAt: scoreProviderFailureStreak > 0 ? scoreRetryTimes[0] ?? null : null,
    providerAllowance,
    scheduleProviderCircuit: scheduleCircuitResult.data,
    scheduleProviderCooldownActive: Boolean(
      scheduleCircuitResult.data &&
      new Date(scheduleCircuitResult.data.next_retry_at).getTime() > now.getTime(),
    ),
    pendingScheduleReviews,
    retention: { ...retention, candidates: retentionCandidates },
    reminderHealth,
  };
}
