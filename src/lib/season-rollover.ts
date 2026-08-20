import { supabaseAdmin } from "@/lib/supabase-admin";

export type AnnualSeasonTurnoverResult = {
  status: "blocked" | "completed";
  targetYear: number;
  completedAt?: string;
  blockers: string[];
  preserved: Record<string, number>;
  deleted: Record<string, number>;
  survivorEntriesCreated?: number;
  retry: boolean;
};

/**
 * Ensures the Eastern-time annual season boundary exists, then performs the
 * certified cleanup only when the previous season is fully settled.
 */
export async function ensureAnnualSeasonRollover(
  evaluatedAt = new Date().toISOString(),
): Promise<AnnualSeasonTurnoverResult> {
  const { error: rolloverError } = await supabaseAdmin.rpc("ensure_annual_season_rollover", {
    evaluated_at: evaluatedAt,
  });
  if (rolloverError) {
    throw new Error("The annual season handoff could not be verified safely.");
  }

  const { data, error: turnoverError } = await supabaseAdmin.rpc(
    "perform_annual_season_turnover",
    { evaluated_at: evaluatedAt },
  );
  if (turnoverError || !data) {
    throw new Error("The annual season cleanup could not be verified safely.");
  }

  // A blocked cleanup is a safe outcome: the new season may continue loading,
  // while the Commissioner and watchdog show exactly what still needs review.
  return data as AnnualSeasonTurnoverResult;
}
