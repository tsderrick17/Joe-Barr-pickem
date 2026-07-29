import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function authenticatedProfilePlayer(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;

  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, active, notification_email, email_notifications_enabled, email_weekly_enabled, email_final_lines_enabled, email_early_lock_enabled, email_pick_due_enabled, email_weekly_recap_enabled, email_ats_due_enabled, email_survivor_due_enabled, email_custom_enabled, push_weekly_enabled, push_final_lines_enabled, push_early_lock_enabled, push_pick_due_enabled, push_weekly_recap_enabled, push_ats_due_enabled, push_survivor_due_enabled, push_custom_enabled")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return player?.active ? player : null;
}
