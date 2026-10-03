import { supabaseAdmin } from "@/lib/supabase-admin";

// Kept apart from the watchdog engine on purpose: the dashboards only read
// this status, and importing the engine would bundle the reminder worker (and
// its image-rendering dependencies) into every dashboard function.
export async function getWatchdogStatus() {
  const [{ data: alerts, error }, { data: lastRun, error: runError }] = await Promise.all([
    supabaseAdmin.from("automation_alerts").select("id, signal_key, severity, title, detail, detected_at, last_seen_at, notified_at, resolved_at, notification_error")
      .order("detected_at", { ascending: false }).limit(20),
    supabaseAdmin.from("sync_runs").select("status, started_at, completed_at, error_message, details")
      .eq("job_type", "watchdog").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error || runError) throw new Error("Watchdog status could not be loaded.");
  return { openAlerts: (alerts ?? []).filter((alert) => !alert.resolved_at), recentAlerts: alerts ?? [], lastRun };
}
