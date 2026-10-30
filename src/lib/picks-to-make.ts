import { supabaseAdmin } from "@/lib/supabase-admin";
import { picksStillToMake } from "@/lib/picks-to-make-rule.js";
import { isSurvivorReminderApplicable } from "@/lib/reminder-rules.js";

/**
 * The picks-to-make number for each of these players in the active week (the number on the app icon). The week's games and every player's picks are
 * read once for the whole group, so a notification to the whole pool costs a handful of reads, not a handful per player.
 */
export async function picksStillToMakeFor(playerIds: string[]) {
  const counts = new Map<string, number>(playerIds.map((id) => [id, 0]));
  if (!playerIds.length) return counts;

  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, max_picks, period_type")
    .eq("status", "active")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (periodError) throw new Error("The active scoring period could not be read.");
  if (!period) return counts;

  const [gamesResult, picksResult, seasonResult] = await Promise.all([
    supabaseAdmin.from("games").select("id, kickoff_at, status").eq("scoring_period_id", period.id),
    supabaseAdmin.from("picks").select("player_id, game_id, result").eq("scoring_period_id", period.id).in("player_id", playerIds),
    supabaseAdmin.from("seasons").select("survivor_champion_player_id").eq("id", period.season_id).maybeSingle(),
  ]);
  if (gamesResult.error || picksResult.error || seasonResult.error) throw new Error("The week's picks could not be read.");

  const now = Date.now();
  const openGameIds = (gamesResult.data ?? [])
    .filter((game) => new Date(game.kickoff_at).getTime() > now && !["postponed", "cancelled", "no_contest"].includes(game.status))
    .map((game) => game.id);
  const pickedByPlayer = new Map<string, string[]>();
  for (const pick of picksResult.data ?? []) {
    if (pick.result === "void") continue;
    pickedByPlayer.set(pick.player_id, [...(pickedByPlayer.get(pick.player_id) ?? []), pick.game_id]);
  }

  const survivorApplicable = isSurvivorReminderApplicable(period.period_type as "regular" | "playoff", Boolean(seasonResult.data?.survivor_champion_player_id));
  const activeEntry = new Map<string, string>();
  const survivorPicked = new Set<string>();
  if (survivorApplicable) {
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("survivor_entries")
      .select("id, player_id")
      .eq("season_id", period.season_id)
      .eq("status", "active")
      .in("player_id", playerIds);
    if (entriesError) throw new Error("Survivor entries could not be read.");
    for (const entry of entries ?? []) activeEntry.set(entry.player_id, entry.id);
    if (activeEntry.size) {
      const { data: survivorPicks, error: survivorError } = await supabaseAdmin
        .from("survivor_picks")
        .select("survivor_entry_id")
        .eq("scoring_period_id", period.id)
        .in("survivor_entry_id", [...activeEntry.values()])
        .neq("result", "void");
      if (survivorError) throw new Error("Survivor pick status could not be read.");
      for (const pick of survivorPicks ?? []) survivorPicked.add(pick.survivor_entry_id);
    }
  }

  for (const playerId of playerIds) {
    const entryId = activeEntry.get(playerId);
    counts.set(playerId, picksStillToMake({
      maxPicks: period.max_picks,
      openGameIds,
      pickedGameIds: pickedByPlayer.get(playerId) ?? [],
      survivorApplicable,
      survivorActive: entryId !== undefined,
      survivorPicked: entryId !== undefined && survivorPicked.has(entryId),
    }));
  }
  return counts;
}
