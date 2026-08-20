import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AutomationJob } from "@/lib/automation-execution-lease";

export type AutomationHeartbeatStatus = "started" | "success" | "failed" | "skipped";

export async function recordAutomationWorkerHeartbeat(
  job: AutomationJob,
  status: AutomationHeartbeatStatus,
) {
  const { error } = await supabaseAdmin.rpc("record_automation_worker_heartbeat", {
    target_job_name: job,
    target_status: status,
  });
  if (error) console.error("Automation worker heartbeat could not be recorded.", { job, status });
}
