import { currentSeasonYear } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findLatestSettledWeeklyRecapPeriod } from "@/lib/weekly-recap-period";
import { assessLinesReady, assessWeekHandoff, assessWeeklyRecap, LINE_PREVIEW_WINDOW_MS } from "@/lib/pool-integrity-health.js";

const HOUR_MS = 60 * 60_000;

export type ProbeOutcome = { healthy: boolean; reason?: string | null };

/** Every game due an official line has one, and a game about to lock has had a line captured. */
export async function checkLinesReady(now: Date): Promise<ProbeOutcome> {
  const from = new Date(now.getTime() - 72 * HOUR_MS).toISOString();
  const to = new Date(now.getTime() + LINE_PREVIEW_WINDOW_MS).toISOString();
  const { data: games, error } = await supabaseAdmin.from("games").select("id, status, line_lock_at").gte("line_lock_at", from).lte("line_lock_at", to);
  if (error) throw error;
  if (!games?.length) return { healthy: true };

  const ids = games.map((game) => game.id);
  const [locked, captured] = await Promise.all([
    supabaseAdmin.from("game_lines").select("game_id").in("game_id", ids),
    supabaseAdmin.from("spread_history").select("game_id").in("game_id", ids),
  ]);
  if (locked.error) throw locked.error;
  if (captured.error) throw captured.error;

  const result = assessLinesReady({
    now: now.getTime(),
    games,
    lockedGameIds: new Set((locked.data ?? []).map((line) => line.game_id)),
    capturedLineGameIds: new Set((captured.data ?? []).map((line) => line.game_id)),
  });
  return { healthy: result.healthy, reason: result.missedLock.length ? `${result.missedLock.length} game(s) past lock without an official line` : result.noLineYet.length ? `${result.noLineYet.length} game(s) about to lock with no line captured` : null };
}

/** The Tuesday recap for the latest settled week was sent (or deliberately cancelled) once it was due. */
export async function checkWeeklyRecap(now: Date): Promise<ProbeOutcome> {
  const period = await findLatestSettledWeeklyRecapPeriod();
  if (!period) return { healthy: true };
  const { data: reminders, error } = await supabaseAdmin
    .from("push_reminders")
    .select("status, cancelled_at, suppression_reason")
    .eq("category", "weekly_recap")
    .eq("source_scoring_period_id", period.id);
  if (error) throw error;
  return assessWeeklyRecap({ now: now.getTime(), settledAt: period.settled_at, reminders: reminders ?? [] });
}

/** A fully settled and graded week handed over to the next one at its scheduled time. */
export async function checkWeekHandoff(now: Date): Promise<ProbeOutcome> {
  const { data: season, error: seasonError } = await supabaseAdmin.from("seasons").select("id").eq("year", currentSeasonYear()).maybeSingle();
  if (seasonError) throw seasonError;
  if (!season) return { healthy: true };

  const { data: periods, error: periodsError } = await supabaseAdmin.from("scoring_periods").select("id, display_order, status").eq("season_id", season.id).order("display_order");
  if (periodsError) throw periodsError;
  const active = (periods ?? []).find((period) => period.status === "active");
  if (!active) return { healthy: true };
  const next = (periods ?? []).find((period) => period.display_order === active.display_order + 1);

  const [games, atsPicks, survivor, nextGames] = await Promise.all([
    supabaseAdmin.from("games").select("status, kickoff_at, finalized_at").eq("scoring_period_id", active.id),
    supabaseAdmin.from("picks").select("id", { count: "exact", head: true }).eq("scoring_period_id", active.id).eq("result", "pending"),
    supabaseAdmin.from("survivor_picks").select("id", { count: "exact", head: true }).eq("scoring_period_id", active.id).eq("result", "pending"),
    next ? supabaseAdmin.from("games").select("kickoff_at").eq("scoring_period_id", next.id).order("kickoff_at").limit(1) : Promise.resolve({ data: [] as { kickoff_at: string }[], error: null }),
  ]);
  if (games.error) throw games.error;
  if (atsPicks.error) throw atsPicks.error;
  if (survivor.error) throw survivor.error;
  if (nextGames.error) throw nextGames.error;

  return assessWeekHandoff({
    now: now.getTime(),
    active: true,
    games: games.data ?? [],
    pendingGradeCount: (atsPicks.count ?? 0) + (survivor.count ?? 0),
    nextKickoffAt: nextGames.data?.[0]?.kickoff_at ?? null,
  });
}
