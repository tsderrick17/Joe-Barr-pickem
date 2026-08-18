import { findLatestSettledWeeklyRecapPeriod } from "@/lib/weekly-recap-period";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { automaticWeeklyRecapAt } from "@/lib/weekly-recap-timing.js";

export async function ensureAutomaticWeeklyRecap(now = new Date()) {
  const period = await findLatestSettledWeeklyRecapPeriod();
  if (!period) return { created: false, reason: "week_not_settled" };
  if (now < new Date(automaticWeeklyRecapAt(period.settled_at))) return { created: false, reason: "before_tuesday" };

  const { data: commissioner, error: commissionerError } = await supabaseAdmin
    .from("players")
    .select("id")
    .eq("active", true)
    .eq("is_commissioner", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (commissionerError || !commissioner) throw new Error("The weekly recap needs an active commissioner sender.");

  const { data: template } = await supabaseAdmin
    .from("reminder_templates")
    .select("title, body")
    .eq("template_id", "weekly_recap")
    .maybeSingle();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("push_reminders")
    .select("id")
    .eq("category", "weekly_recap")
    .eq("source_scoring_period_id", period.id)
    .maybeSingle();
  if (existingError) throw new Error("The existing Tuesday recap could not be checked.");
  if (existing) return { created: false, reason: "already_queued" };

  const { data, error } = await supabaseAdmin
    .from("push_reminders")
    .insert({
      created_by_player_id: commissioner.id,
      category: "weekly_recap",
      audience: "all_active",
      title: template?.title || `${period.display_name} results and standings`,
      body: template?.body || "The final results, updated Pick'em standings, and Survivor recap are ready.",
      scheduled_for: now.toISOString(),
      source_scoring_period_id: period.id,
      automation_key: `plan:${period.id}:weekly_recap`,
    })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return { created: false, reason: "already_queued" };
  if (error) throw new Error("The automatic Tuesday recap could not be queued.");
  return { created: Boolean(data), reason: data ? null : "already_queued" };
}
