import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordAutomationWorkerHeartbeat } from "@/lib/critical-worker-heartbeat-recorder";

export type AutomationJob = "line_locks" | "scores" | "bowl_scores" | "reminders" | "season_bootstrap" | "watchdog" | "schedule_refresh";

const leaseSecondsByJob: Record<AutomationJob, number> = {
  line_locks: 120,
  scores: 300,
  bowl_scores: 300,
  reminders: 600,
  season_bootstrap: 600,
  watchdog: 120,
  schedule_refresh: 600,
};

const executionTimeoutSecondsByJob: Record<AutomationJob, number> = {
  line_locks: 90,
  scores: 270,
  bowl_scores: 270,
  reminders: 540,
  season_bootstrap: 540,
  watchdog: 90,
  schedule_refresh: 540,
};

const LEASE_CLAIM_RETRY_DELAYS_MS = [150, 450];

async function claimAutomationLease(job: AutomationJob) {
  for (let attempt = 0; attempt <= LEASE_CLAIM_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data: token, error } = await supabaseAdmin.rpc(
      "claim_automation_execution_lease",
      { target_job_name: job, lease_seconds: leaseSecondsByJob[job] },
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
    const label = job === "line_locks"
      ? "Official line locking"
      : job === "scores"
        ? "Final-score sync"
        : job === "bowl_scores"
          ? "Bowl Pool score sync"
        : job === "schedule_refresh"
          ? "NFL schedule refresh"
        : job === "season_bootstrap"
          ? "Season schedule bootstrap"
          : job === "watchdog"
            ? "Operations watchdog"
            : "Email reminder delivery";
    super(`${label} is already running.`);
    this.name = "AutomationAlreadyRunningError";
  }
}

export class AutomationExecutionTimeoutError extends Error {
  constructor(job: AutomationJob) {
    super(`${job} exceeded its execution safety timeout.`);
    this.name = "AutomationExecutionTimeoutError";
  }
}

async function withExecutionTimeout<T>(job: AutomationJob, task: () => Promise<T>) {
  const timeoutMs = executionTimeoutSecondsByJob[job] * 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AutomationExecutionTimeoutError(job)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
