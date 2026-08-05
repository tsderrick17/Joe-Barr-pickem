import { supabaseAdmin } from "@/lib/supabase-admin";

/** Ensures the Eastern-time annual season boundary exists before any scorer runs. */
export async function ensureAnnualSeasonRollover(
  evaluatedAt = new Date().toISOString(),
) {
  const { error } = await supabaseAdmin.rpc("ensure_annual_season_rollover", {
    evaluated_at: evaluatedAt,
  });
  if (error) {
    throw new Error("The annual season handoff could not be verified safely.");
  }
}
