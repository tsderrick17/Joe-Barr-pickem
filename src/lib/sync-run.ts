import { supabaseAdmin } from "@/lib/supabase-admin";

const RETRY_DELAY_MS = 150;

type SyncRunFields = {
  status: "success" | "failed" | "skipped";
  completed_at: string;
  error_message?: string | null;
  details?: unknown;
};

/**
 * Records how a run ended. The work has already succeeded or failed by the
 * time this is called, so a bookkeeping failure must never turn a finished run
 * into a thrown error. It is retried once and then reported in the server log,
 * because a run left as "started" is the signal the watchdog reads.
 */
export async function finishSyncRun(runId: string, fields: SyncRunFields) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabaseAdmin
      .from("sync_runs")
      .update(fields)
      .eq("id", runId);

    if (!error) return true;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  console.error("A sync run outcome could not be recorded.", { runId, status: fields.status });
  return false;
}
