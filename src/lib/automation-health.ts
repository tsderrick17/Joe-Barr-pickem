import { checkReminderHealth } from "@/lib/reminder-health";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AutomationRun = {
  job_type: "line_locks" | "scores";
  status: "started" | "success" | "failed";
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

function latestByJob(
  runs: AutomationRun[],
  job: AutomationRun["job_type"],
) {
  return runs.find((run) => run.job_type === job) ?? null;
}

export async function checkAutomationHealth(now = new Date()) {
  const checkedAt = now.toISOString();
  const scoreDueAt = new Date(
    // Final-score checks begin three hours after kickoff and run every
    // 15 minutes. Give the first scheduled check one full interval plus a
    // small execution buffer before declaring the automation stale.
    now.getTime() - (3 * 60 + 20) * 60 * 1000,
  ).toISOString();
  const lineHealthDueAt = new Date(
    now.getTime() - 5 * 60 * 1000,
  ).toISOString();
  const [runsResult, lineCandidatesResult, scoreGamesResult, reminderHealth] =
    await Promise.all([
      supabaseAdmin
        .from("sync_runs")
        .select(
          "job_type, status, started_at, completed_at, error_message",
        )
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
    ]);

  if (
    runsResult.error ||
    lineCandidatesResult.error ||
    scoreGamesResult.error
  ) {
    throw new Error("Automation health could not be prepared.");
  }

  const lineCandidateIds = (lineCandidatesResult.data ?? []).map(
    (game) => game.id,
  );
  const { data: lines, error: linesError } = lineCandidateIds.length
    ? await supabaseAdmin
        .from("game_lines")
        .select("game_id")
        .in("game_id", lineCandidateIds)
    : { data: [], error: null };

  if (linesError) {
    throw new Error("Automation health could not verify official lines.");
  }

  const runs = (runsResult.data ?? []) as AutomationRun[];
  const latestLocks = latestByJob(runs, "line_locks");
  const latestScores = latestByJob(runs, "scores");
  const lockedIds = new Set((lines ?? []).map((line) => line.game_id));
  const missingOfficialLines = lineCandidateIds.filter(
    (id) => !lockedIds.has(id),
  ).length;
  const scoreCandidates = (scoreGamesResult.data ?? []).length;
  const problems: string[] = [];

  if (latestLocks?.status === "failed" && missingOfficialLines > 0) {
    problems.push(
      "The most recent official-line lock failed while a game needs an official line.",
    );
  }
  if (latestScores?.status === "failed" && scoreCandidates > 0) {
    problems.push(
      "The most recent final-score sync failed while games are awaiting review.",
    );
  }
  if (missingOfficialLines > 0) {
    problems.push(
      `${missingOfficialLines} game${missingOfficialLines === 1 ? " is" : "s are"} past line lock without an official line.`,
    );
  }

  const latestScoreFinishedAt = latestScores
    ? new Date(latestScores.completed_at ?? latestScores.started_at).getTime()
    : 0;
  if (
    scoreCandidates > 0 &&
    (!latestScores ||
      latestScores.status !== "success" ||
      now.getTime() - latestScoreFinishedAt > 30 * 60 * 1000)
  ) {
    problems.push(
      "Final-score sync is stale while games are awaiting review.",
    );
  }

  problems.push(...reminderHealth.problems);

  return {
    checkedAt,
    status: problems.length ? ("attention" as const) : ("healthy" as const),
    problems,
    latestLocks,
    latestScores,
    missingOfficialLines,
    scoreCandidates,
    reminderHealth,
  };
}
