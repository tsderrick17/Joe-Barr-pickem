import { supabaseAdmin } from "@/lib/supabase-admin";

// Activity is intentionally coarse: it records that a player used Pick'em,
// not which screen they viewed, what they picked, or where they were.
const ACTIVITY_WRITE_INTERVAL_MS = 15 * 60_000;
const lastAttemptByPlayer = new Map<string, number>();

export async function recordPlayerActivity(playerId: string) {
  const now = Date.now();
  const lastAttempt = lastAttemptByPlayer.get(playerId) ?? 0;
  if (now - lastAttempt < ACTIVITY_WRITE_INTERVAL_MS) return;

  lastAttemptByPlayer.set(playerId, now);
  if (lastAttemptByPlayer.size > 256) {
    for (const [id, attemptedAt] of lastAttemptByPlayer) {
      if (now - attemptedAt >= ACTIVITY_WRITE_INTERVAL_MS) lastAttemptByPlayer.delete(id);
    }
  }

  const timestamp = new Date(now).toISOString();
  const cutoff = new Date(now - ACTIVITY_WRITE_INTERVAL_MS).toISOString();
  const { error } = await supabaseAdmin
    .from("players")
    .update({ last_active_at: timestamp })
    .eq("id", playerId)
    // The database condition also coalesces writes from separate serverless
    // instances that happen to see the same activity at once.
    .or(`last_active_at.is.null,last_active_at.lte.${cutoff}`);

  // Presence is a Commissioner convenience, never a reason to make a player
  // lose access or fail a saved selection during a transient database issue.
  if (error) {
    lastAttemptByPlayer.delete(playerId);
    console.error("Player activity could not be recorded.", error.code);
  }
}
