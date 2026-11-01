import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Json } from "@/lib/database.types";

/** The workers that raise warnings: the lease jobs plus the pool-integrity health checks, which run as their own routes. */
export type WarningJob = "line_locks" | "scores" | "bowl_scores" | "reminders" | "reminder_schedule" | "season_bootstrap" | "watchdog" | "schedule_refresh" | "pool_integrity";

// A loop that hits the same problem for every game would otherwise save and report it once per game. Within one server
// instance the same warning is saved at most once in this window; the database keeps the 12-hour rule for Sentry.
const SAME_WARNING_WINDOW_MS = 10 * 60 * 1000;
const recentlyNoted = new Map<string, number>();

export function resetOperationalWarningMemo() { recentlyNoted.clear(); }

/**
 * A problem a worker works around (a skipped save, an ESPN game that vanished, a failed alert) and that the Commissioner should still be able to see.
 *
 * It does three things, in this order, and never throws, because the worker has already coped with the problem and must carry on:
 *  - writes the line to the server log, as before;
 *  - saves it to operational_warnings (one row per job and wording, counting repeats) so Commissioner → Automation can show it long after the Hobby log is gone;
 *  - reports it to Sentry as a warning, once when it first appears and again only if it comes back after 12 quiet hours.
 * `message` is fixed wording; anything that varies (a game, an error code) goes in `details`.
 */
export async function noteOperationalWarning(job: WarningJob, message: string, details: Record<string, Json | undefined> = {}) {
  console.warn(message, details);

  const key = `${job}:${message}`;
  const now = Date.now();
  const last = recentlyNoted.get(key);
  if (last !== undefined && now - last < SAME_WARNING_WINDOW_MS) return;
  recentlyNoted.set(key, now);

  // If the warning cannot be saved, report it anyway: the database being unreachable is when a warning matters most.
  let report = true;
  try {
    const { data, error } = await supabaseAdmin.rpc("record_operational_warning", { target_job: job, target_message: message, target_details: details });
    if (error) console.error("An operational warning could not be saved.", { job });
    else report = data === true;
  } catch {
    console.error("An operational warning could not be saved.", { job });
  }

  if (!report) return;
  try { Sentry.captureMessage(message, { level: "warning", tags: { job }, extra: details }); }
  catch { /* Reporting is a courtesy; the saved warning is the record. */ }
}
