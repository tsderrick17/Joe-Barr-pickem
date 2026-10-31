import { supabaseAdmin } from "@/lib/supabase-admin";

// A Bowl game's queued reminders (lines-are-set, pick-due, recap) are cancelled when its kickoff moves. The key that stops a reminder
// being queued twice is unique, so a cancelled reminder that kept its key would stop the game's new time from ever queuing a fresh one.
export async function cancelQueuedBowlReminders(gameId: string) {
  const { error } = await supabaseAdmin.from("push_reminders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), suppression_reason: "bowl_schedule_changed", automation_key: null })
    .in("category", ["bowl_pick_due", "bowl_line_lock", "bowl_daily_recap"]).eq("status", "scheduled").contains("source_game_ids", [gameId]);
  if (error) throw new Error("Reminders for a rescheduled Bowl game could not be cancelled.");
}
