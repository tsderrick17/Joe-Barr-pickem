import { supabaseAdmin } from "@/lib/supabase-admin";

export type SurvivorNoPickResult = { entries_eliminated: number };

export async function eliminateSurvivorNoPicks(
  evaluatedAt = new Date().toISOString(),
): Promise<SurvivorNoPickResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "eliminate_survivor_no_picks",
    { evaluated_at: evaluatedAt },
  );

  if (error) {
    throw new Error("Survivor no-pick status could not be evaluated safely.");
  }

  return (data?.[0] as SurvivorNoPickResult | undefined) ?? {
    entries_eliminated: 0,
  };
}
