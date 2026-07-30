import { supabaseAdmin } from "@/lib/supabase-admin";

export type VoidDisruptedPicksResult = {
  ats_voided: number;
  survivor_voided: number;
};

// This integrity RPC is required. Treat migration drift as an outage instead
// of silently accepting picks without the disruption safeguard.
export async function voidDisruptedPicks(): Promise<VoidDisruptedPicksResult> {
  const { data, error } = await supabaseAdmin.rpc("void_disrupted_picks");
  if (error) throw new Error("Disrupted-game picks could not be voided safely.");

  return (data?.[0] as VoidDisruptedPicksResult | undefined) ?? {
    ats_voided: 0,
    survivor_voided: 0,
  };
}
