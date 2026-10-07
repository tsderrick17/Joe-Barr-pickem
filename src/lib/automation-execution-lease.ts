import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordAutomationWorkerHeartbeat } from "@/lib/critical-worker-heartbeat-recorder";
import { runInExecutionContext } from "@/lib/execution-context";

export type AutomationJob = "line_locks" | "scores" | "bowl_scores" | "reminders" | "reminder_schedule" | "season_bootstrap" | "watchdog" | "schedule_refresh";

// One row per job: the database lease length, the in-process safety timeout
// (always shorter, so the lease outlives a timed-out run), and the wording used
// when a duplicate run is refused. Adding a job means adding one row here plus
// the matching database constraint.
const jobSettings: Record<AutomationJob, { leaseSeconds: number; timeoutSeconds: number; label: string }> = {
  line_locks: { leaseSeconds: 120, timeoutSeconds: 90, label: "Official line locking" },
  scores: { leaseSeconds: 300, timeoutSeconds: 270, label: "Final-score sync" },
  bowl_scores: { leaseSeconds: 300, timeoutSeconds: 270, label: "Bowl Pool score sync" },
  reminders: { leaseSeconds: 600, timeoutSeconds: 540, label: "Email reminder delivery" },
  reminder_schedule: { leaseSeconds: 600, timeoutSeconds: 540, label: "Reminder schedule maintenance" },
  season_bootstrap: { leaseSeconds: 600, timeoutSeconds: 540, label: "Season schedule bootstrap" },
  watchdog: { leaseSeconds: 120, timeoutSeconds: 90, label: "Operations watchdog" },
  schedule_refresh: { leaseSeconds: 600, timeoutSeconds: 540, label: "NFL schedule refresh" },
};

const LEASE_CLAIM_RETRY_DELAYS_MS = [150, 450];

async function claimAutomationLease(job: AutomationJob) {
  for (let attempt = 0; attempt <= LEASE_CLAIM_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data: token, error } = await supabaseAdmin.rpc(
      "claim_automation_execution_lease",
      { target_job_name: job, lease_seconds: jobSettings[job].leaseSeconds },
    );

    if (!error) return { token, error: null };

    if (attempt < LEASE_CLAIM_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, LEASE_CLAIM_RETRY_DELAYS_MS[attempt]));
    } else {
      console.error("Automation execution lease claim failed after bounded retries.", {
        job,
        error: error.message,
      });
      return { token: null, error };
    }
  }

  return { token: null, error: new Error("The automation execution lease could not be acquired.") };
}

export class AutomationAlreadyRunningError extends Error {
  constructor(job: AutomationJob) {
    super(`${jobSettings[job].label} is already running.`);
    this.name = "AutomationAlreadyRunningError";
  }
}

export class AutomationExecutionTimeoutError extends Error {
  constructor(job: AutomationJob) {
    super(`${job} exceeded its execution safety timeout.`);
    this.name = "AutomationExecutionTimeoutError";
  }
}

/**
 * Runs `task` with a deadline: the caller is released with a timeout error when it passes, and the run's context is
 * cancelled so the task stops at its next checkpoint instead of starting more work. Exported so the timeout
 * boundary can be tested with a short deadline.
 */
export async function runWithDeadline<T>(job: AutomationJob, timeoutMs: number, task: () => Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { result, cancel } = runInExecutionContext(timeoutMs, task);
  // After a timeout the task's own outcome no longer matters to the caller: it is stopped at its next checkpoint,
  // and whatever it throws then must not surface as an unhandled rejection.
  result.catch(() => undefined);
  try {
    return await Promise.race([
      result,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const timeout = new AutomationExecutionTimeoutError(job);
          cancel(timeout);
          reject(timeout);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function withExecutionTimeout<T>(job: AutomationJob, task: () => Promise<T>) {
  return runWithDeadline(job, jobSettings[job].timeoutSeconds * 1000, task);
}

export async function runWithAutomationLease<T>(
  job: AutomationJob,
  task: () => Promise<T>,
): Promise<T> {
  await recordAutomationWorkerHeartbeat(job, "started");
  const { token, error } = await claimAutomationLease(job);

  if (error) {
    await recordAutomationWorkerHeartbeat(job, "failed");
    throw new Error("The automation execution lease could not be acquired.");
  }

  if (!token) {
    await recordAutomationWorkerHeartbeat(job, "skipped");
    throw new AutomationAlreadyRunningError(job);
  }

  let timedOut = false;
  try {
    const result = await withExecutionTimeout(job, task);
    await recordAutomationWorkerHeartbeat(job, "success");
    return result;
  } catch (error) {
    timedOut = error instanceof AutomationExecutionTimeoutError;
    await recordAutomationWorkerHeartbeat(job, "failed");
    throw error;
  } finally {
    if (timedOut) {
      console.error("Automation lease retained until expiry after execution timeout.", { job });
    } else {
      let { error: releaseError } = await supabaseAdmin.rpc(
      "release_automation_execution_lease",
      { target_job_name: job, lease_token: token },
      );

      if (releaseError) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        ({ error: releaseError } = await supabaseAdmin.rpc(
          "release_automation_execution_lease",
          { target_job_name: job, lease_token: token },
        ));
      }

      if (releaseError) {
        console.error("Automation lease release failed.", { job });
      }
    }
  }
}
