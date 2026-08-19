import { supabaseAdmin } from "@/lib/supabase-admin";

// Activity is intentionally coarse: it records that a player used Pick'em,
// not which screen they viewed, what they picked, or where they were.
export async function recordPlayerActivity(playerId: string) {
  const { error } = await supabaseAdmin
    .from("players")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", playerId);

  // Presence is a Commissioner convenience, never a reason to make a player
  // lose access or fail a saved selection during a transient database issue.
  if (error) console.error("Player activity could not be recorded.", error.code);
}
