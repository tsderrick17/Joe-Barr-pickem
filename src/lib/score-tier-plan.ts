import { latestProviderCreditSnapshot, monthlyCreditSeries } from "@/lib/provider-chart-data.js";
import { chooseScoreTier, LOW_BALANCE_USED_CREDITS } from "@/lib/score-polling-tier.js";
import { SCORE_RETRY_MINUTES } from "@/lib/score-retry-ladder.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ScoreTier = "normal" | "lean" | "minimal" | "paused";
export type ScoreTierPlan = ReturnType<typeof chooseScoreTier> & { tier: ScoreTier };
type CreditReading = { used: number; remaining: number; reportedAt: string } | null;

/** The reading counts only if it was taken this calendar month: the Odds API allowance renews on the 1st (UTC). */
function readingThisMonth(reading: CreditReading, now: Date) {
  if (!reading) return null;
  const at = new Date(reading.reportedAt);
  return at.getUTCFullYear() === now.getUTCFullYear() && at.getUTCMonth() === now.getUTCMonth() ? reading : null;
}

/**
 * Which score-check tier to run right now (see score-polling-tier.js). Under LOW_BALANCE_USED_CREDITS used, or with no reading this month,
 * the answer is Normal without reading anything else. From there it prices the rest of the month exactly as the Commissioner's credit chart does
 * (monthlyCreditSeries, from this month's provider calls and the month's schedule), so what the Performance tab shows is what the worker runs.
 * `reading` is the latest credit reading when the caller already has it; otherwise the last provider runs are read for it.
 */
export async function decideScoreTier(now: Date, reading?: CreditReading): Promise<ScoreTierPlan> {
  let latest = reading;
  if (latest === undefined) {
    const { data, error } = await supabaseAdmin
      .from("sync_runs")
      .select("details, completed_at, started_at")
      .eq("provider", "The Odds API")
      .in("status", ["success", "failed"])
      .order("started_at", { ascending: false })
      .limit(25);
    if (error) throw new Error("Recent score-provider usage could not be loaded.");
    latest = latestProviderCreditSnapshot(data ?? []);
  }
  const current = readingThisMonth(latest, now);
  if (!current || current.used < LOW_BALANCE_USED_CREDITS) {
    return chooseScoreTier({ usedCredits: current?.used ?? null, remainingCredits: current?.remaining ?? null, lineNeedCredits: 0, leanNeedCredits: 0, minimalNeedCredits: 0 }) as ScoreTierPlan;
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [runs, games] = await Promise.all([
    supabaseAdmin
      .from("sync_runs")
      .select("id, job_type, status, details, completed_at, started_at")
      .eq("provider", "The Odds API")
      .in("status", ["success", "failed"])
      .gte("started_at", monthStart.toISOString())
      .order("started_at", { ascending: true })
      .range(0, 999),
    supabaseAdmin
      .from("games")
      .select("id, kickoff_at, line_lock_at, finalized_at, status")
      .gte("kickoff_at", new Date(now.getTime() - 15 * 86_400_000).toISOString())
      .lt("kickoff_at", monthEnd.toISOString())
      .order("kickoff_at"),
  ]);
  if (runs.error || games.error) throw new Error("The rest of the month's provider needs could not be loaded.");
  return monthlyCreditSeries(runs.data ?? [], now, games.data ?? [], [...SCORE_RETRY_MINUTES]).tierPlan as ScoreTierPlan;
}
