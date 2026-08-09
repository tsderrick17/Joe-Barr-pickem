import { supabaseAdmin } from "@/lib/supabase-admin";

export type AutomationJob = "line_locks" | "scores" | "reminders" | "season_bootstrap" | "watchdog" | "schedule_refresh";

export class AutomationAlreadyRunningError extends Error {
  constructor(job: AutomationJob) {
    const label = job === "line_locks"
      ? "Official line locking"
      : job === "scores"
        ? "Final-score sync"
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

export async function runWithAutomationLease<T>(
  job: AutomationJob,
  task: () => Promise<T>,
): Promise<T> {
  const { data: token, error } = await supabaseAdmin.rpc(
    "claim_automation_execution_lease",
    { target_job_name: job, lease_seconds: 120 },
  );

  if (error) {
    throw new Error("The automation execution lease could not be acquired.");
  }

  if (!token) {
    throw new AutomationAlreadyRunningError(job);
  }

  try {
    return await task();
  } finally {
    const { error: releaseError } = await supabaseAdmin.rpc(
      "release_automation_execution_lease",
      { target_job_name: job, lease_token: token },
    );

    if (releaseError) {
      console.error("Automation lease release failed.", { job });
    }
  }
}
