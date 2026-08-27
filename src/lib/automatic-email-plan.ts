import { buildEmailPlanSchedule } from "@/lib/email-plan-schedule.js";
import { automaticEmailSubject } from "@/lib/email-subjects.js";
import { reminderTemplates } from "@/lib/reminder-templates";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function ensureAutomaticEmailPlanMessages() {
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, period_type, display_name")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (periodError) throw new Error("The active week could not be loaded for automatic emails.");
  if (!period) return { created: 0, reason: "no_active_period" };

  const [{ data: games, error: gamesError }, { data: commissioner, error: commissionerError }, { data: overrides, error: templateError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at, line_lock_at, is_international, status").eq("scoring_period_id", period.id),
    supabaseAdmin.from("players").select("id").eq("active", true).eq("is_commissioner", true).order("created_at").limit(1).maybeSingle(),
    supabaseAdmin.from("reminder_templates").select("template_id, title, body"),
  ]);
  if (gamesError) throw new Error("The active schedule could not be loaded for automatic emails.");
  if (commissionerError || !commissioner) throw new Error("Automatic emails need an active commissioner sender.");
  if (templateError) throw new Error("The saved email wording could not be loaded.");

  const teamIds = [...new Set((games ?? []).flatMap((game) => [game.away_team_id, game.home_team_id]))];
  const { data: teams, error: teamsError } = teamIds.length
    ? await supabaseAdmin.from("teams").select("id, mascot").in("id", teamIds)
    : { data: [], error: null };
  if (teamsError) throw new Error("Automatic email matchup labels could not be loaded.");

  const schedule = buildEmailPlanSchedule(period, games ?? []);
  if (!schedule.length) return { created: 0, reason: "no_games" };
  const overrideById = new Map((overrides ?? []).map((item) => [item.template_id, item]));
  const defaultById = new Map(reminderTemplates.map((item) => [item.id, item]));
  const gameById = new Map((games ?? []).map((game) => [game.id, game]));
  const mascotById = new Map((teams ?? []).map((team) => [team.id, team.mascot]));
  const rows = schedule.map((item) => {
    const wording = overrideById.get(item.templateId) ?? defaultById.get(item.templateId);
    if (!wording) throw new Error(`Automatic email wording is missing for ${item.templateId}.`);
    const sourceKickoff = item.sourceGameIds.map((id) => gameById.get(id)?.kickoff_at).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
    const matchupLabel = item.templateId === "playoff_public_reveal"
      ? item.sourceGameIds.map((id) => {
          const game = gameById.get(id);
          if (!game) return null;
          return `${mascotById.get(game.away_team_id) ?? "Away"} vs. ${mascotById.get(game.home_team_id) ?? "Home"}`;
        }).filter((value): value is string => Boolean(value)).join(" + ")
      : null;
    return {
      created_by_player_id: commissioner.id,
      category: item.category,
      audience: item.audience,
      title: automaticEmailSubject({ templateId: item.templateId, title: wording.title, periodName: period.display_name, eventAt: sourceKickoff, matchupLabel }),
      body: wording.body,
      scheduled_for: item.scheduledFor,
      source_scoring_period_id: item.sourceScoringPeriodId,
      source_game_ids: item.sourceGameIds,
      automation_key: item.automationKey,
    };
  });
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("push_reminders")
    .select("automation_key, status")
    .eq("source_scoring_period_id", period.id)
    .not("automation_key", "is", null);
  if (existingError) throw new Error("Existing automatic emails could not be reconciled.");

  const currentKeys = new Set(rows.map((row) => row.automation_key));
  const staleScheduledKeys = (existing ?? [])
    .filter((item) => item.status === "scheduled" && item.automation_key && !currentKeys.has(item.automation_key))
    .map((item) => item.automation_key);
  if (staleScheduledKeys.length) {
    const { error: deleteError } = await supabaseAdmin
      .from("push_reminders")
      .delete()
      .eq("status", "scheduled")
      .in("automation_key", staleScheduledKeys);
    if (deleteError) throw new Error("Outdated automatic emails could not be replaced after a schedule change.");
  }

  for (const row of rows) {
    const { error: updateError } = await supabaseAdmin
      .from("push_reminders")
      .update(row)
      .eq("automation_key", row.automation_key)
      .eq("status", "scheduled");
    if (updateError) throw new Error("A scheduled automatic email could not follow the latest schedule or wording.");
  }

  const { data, error } = await supabaseAdmin.from("push_reminders").upsert(rows, { onConflict: "automation_key", ignoreDuplicates: true }).select("id");
  if (error) throw new Error("The automatic email plan could not be queued.");
  return { created: data?.length ?? 0, reason: null };
}
