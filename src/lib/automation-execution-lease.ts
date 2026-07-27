import { supabaseAdmin } from "@/lib/supabase-admin";

export type AutomationJob = "line_locks" | "scores";

export class AutomationAlreadyRunningError extends Error {
  constructor(job: AutomationJob) {
    super(`${job === "line_locks" ? "Official line locking" : "Final-score sync"} is already running.`);
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
