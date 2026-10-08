import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { lockDueLines } from "@/lib/lock-due-lines";
import { sendDueReminders } from "@/lib/reminder-worker";
import { syncFinalScores } from "@/lib/sync-final-scores";

export type CriticalWorkerRecovery = {
  job: "line_locks" | "scores" | "reminders";
  outcome: "recovered" | "already-running" | "failed";
};

/**
 * The watchdog is allowed to recover only work that the shared critical-worker
 * assessment has proved is both due and unhealthy. Each operation still uses
 * its normal lease, provider limits, and idempotent worker implementation.
 */
export async function recoverCriticalWorkerWork(health: { criticalWorkers: { problems: Array<{ jobName: string }> } }) {
  const jobs = new Set(health.criticalWorkers.problems.map((problem) => problem.jobName));
  const recoveryTasks: Array<readonly [CriticalWorkerRecovery["job"], () => Promise<unknown>]> = [];

  if (jobs.has("line_locks")) recoveryTasks.push(["line_locks", () => runWithAutomationLease("line_locks", lockDueLines)]);
  if (jobs.has("scores")) recoveryTasks.push(["scores", () => runWithAutomationLease("scores", syncFinalScores)]);
  if (jobs.has("reminders")) recoveryTasks.push(["reminders", () => runWithAutomationLease("reminders", sendDueReminders)]);

  const recoveries: CriticalWorkerRecovery[] = [];
  for (const [job, task] of recoveryTasks) {
    try {
      await task();
      recoveries.push({ job, outcome: "recovered" });
    } catch (error) {
      if (error instanceof AutomationAlreadyRunningError) {
        recoveries.push({ job, outcome: "already-running" });
        continue;
      }
      console.error("Critical worker recovery failed.", { job });
      recoveries.push({ job, outcome: "failed" });
    }
  }
  return recoveries;
}
