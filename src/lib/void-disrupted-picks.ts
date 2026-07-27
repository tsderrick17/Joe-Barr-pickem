import { supabaseAdmin } from "@/lib/supabase-admin";

export type VoidDisruptedPicksResult = {
  ats_voided: number;
  survivor_voided: number;
};

// During the short deployment window before its matching SQL migration is run,
// leave the existing app usable. Once installed, this RPC is safe to call from
// every player and automation entry point because it is idempotent.
export async function voidDisruptedPicks(): Promise<VoidDisruptedPicksResult> {
  const { data, error } = await supabaseAdmin.rpc("void_disrupted_picks");
  if (error?.code === "PGRST202") return { ats_voided: 0, survivor_voided: 0 };
  if (error) throw new Error("Disrupted-game picks could not be voided safely.");

  return (data?.[0] as VoidDisruptedPicksResult | undefined) ?? {
    ats_voided: 0,
    survivor_voided: 0,
  };
}
