import { findLatestSettledWeeklyRecapPeriod } from "@/lib/weekly-recap-period";
import { automaticEmailSubject } from "@/lib/email-subjects.js";
import { reminderTemplate } from "@/lib/reminder-templates";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { weeklyRecapTemplateId } from "@/lib/weekly-recap-template.js";
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

  const [{ data: templates, error: templatesError }, { data: survivorEntries, error: survivorError }, { data: season, error: seasonError }] = await Promise.all([
    supabaseAdmin.from("reminder_templates").select("template_id, title, body").in("template_id", ["weekly_recap", "weekly_recap_pickem_only"]),
    supabaseAdmin.from("survivor_entries").select("status, eliminated_scoring_period_id").eq("season_id", period.season_id),
    supabaseAdmin.from("seasons").select("survivor_champion_player_id").eq("id", period.season_id).maybeSingle(),
  ]);
  if (templatesError || survivorError || seasonError) throw new Error("The weekly recap wording could not be prepared.");
  const activeEntryCount = (survivorEntries ?? []).filter((entry) => entry.status === "active").length;
  const championCrownedThisWeek = Boolean(season?.survivor_champion_player_id && (survivorEntries ?? []).some((entry) => entry.eliminated_scoring_period_id === period.id));
  const templateId = weeklyRecapTemplateId({ activeEntryCount, championCrownedInPeriod: championCrownedThisWeek });
  const savedTemplate = (templates ?? []).find((template) => template.template_id === templateId);
  const fallbackTemplate = reminderTemplate(templateId)!;

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
      title: automaticEmailSubject({ templateId, title: savedTemplate?.title || fallbackTemplate.title, periodName: period.display_name }),
      body: savedTemplate?.body || fallbackTemplate.body,
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
