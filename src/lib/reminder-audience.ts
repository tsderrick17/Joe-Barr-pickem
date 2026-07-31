import { supabaseAdmin } from "@/lib/supabase-admin";

export type ReminderCategory =
  | "weekly"
  | "final_lines"
  | "sunday_final_lines"
  | "early_lock"
  | "pick_due"
  | "weekly_recap"
  | "playoff_day_recap"
  | "playoff_public_reveal"
  | "sunday_early_reveal"
  | "sunday_late_reveal"
  | "featured_window_reveal"
  | "ats_due"
  | "survivor_due"
  | "custom";

export type ReminderAudience =
  | "all_active"
  | "pick_due"
  | "ats_due"
  | "survivor_due";

async function activePeriod() {
  const { data, error } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, max_picks")
    .eq("status", "active")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("The active scoring period could not be read.");
  return data;
}

export async function eligiblePlayerIds(audience: ReminderAudience) {
  const { data: activePlayers, error } = await supabaseAdmin
    .from("players")
    .select("id")
    .eq("active", true);

  if (error) throw new Error("Active players could not be read.");

  const activeIds = (activePlayers ?? []).map((player) => player.id);
  if (audience === "all_active" || activeIds.length === 0) return activeIds;

  const period = await activePeriod();
  if (!period) return [];

  const atsPlayersDue = async () => {
    const { data: picks, error: picksError } = await supabaseAdmin
      .from("picks")
      .select("player_id, result")
      .eq("scoring_period_id", period.id)
      .in("player_id", activeIds);

    if (picksError) throw new Error("Pick status could not be read.");

    const counts = new Map<string, number>();
    for (const pick of picks ?? []) {
      if (pick.result !== "void") {
        counts.set(pick.player_id, (counts.get(pick.player_id) ?? 0) + 1);
      }
    }

    return activeIds.filter(
      (playerId) => (counts.get(playerId) ?? 0) < period.max_picks,
    );
  };

  if (audience === "ats_due") return atsPlayersDue();

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("survivor_entries")
    .select("id, player_id")
    .eq("season_id", period.season_id)
    .eq("status", "active")
    .in("player_id", activeIds);

  if (entriesError) throw new Error("Survivor entries could not be read.");

  const entryIds = (entries ?? []).map((entry) => entry.id);
  if (entryIds.length === 0) return [];

  const { data: survivorPicks, error: survivorError } = await supabaseAdmin
    .from("survivor_picks")
    .select("survivor_entry_id")
    .eq("scoring_period_id", period.id)
    .in("survivor_entry_id", entryIds)
    .neq("result", "void");

  if (survivorError) throw new Error("Survivor pick status could not be read.");

  const pickedEntryIds = new Set(
    (survivorPicks ?? []).map((pick) => pick.survivor_entry_id),
  );
  const survivorPlayersDue = (entries ?? [])
    .filter((entry) => !pickedEntryIds.has(entry.id))
    .map((entry) => entry.player_id);

  if (audience === "survivor_due") return survivorPlayersDue;

  // This courteous check never names a pool. It is sent only if either the
  // player's ATS card or active Survivor entry still needs a selection.
  const atsDue = await atsPlayersDue();
  return [...new Set([...atsDue, ...survivorPlayersDue])];
}
