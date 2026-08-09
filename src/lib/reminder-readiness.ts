import type { ReminderCategory } from "@/lib/reminder-audience";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findLatestSettledWeeklyRecapPeriod } from "@/lib/weekly-recap-period";
import {
  isFreshSlateReady,
  isPlayoffDayRecapReady,
  isSundayWindowReady,
} from "@/lib/reminder-readiness-rules.js";

type ReminderReadiness = { ready: boolean; reason: string | null };

function easternDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

async function activePeriod() {
  const { data, error } = await supabaseAdmin
    .from("scoring_periods")
    .select("id")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("The active week could not be checked before sending a reminder.");
  return data;
}

async function hasOfficialLines(gameIds: string[]) {
  if (!gameIds.length) return false;
  const { data, error } = await supabaseAdmin
    .from("game_lines")
    .select("game_id")
    .in("game_id", gameIds);
  if (error) throw new Error("Official lines could not be checked before sending a reminder.");
  return new Set((data ?? []).map((line) => line.game_id)).size === gameIds.length;
}

async function freshSlateReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "The new week is not active yet." };
  const { count, error } = await supabaseAdmin
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("scoring_period_id", period.id);
  if (error) throw new Error("The new Slate could not be checked before sending a reminder.");
  return isFreshSlateReady({ activePeriod: period, gameCount: count ?? 0 });
}

async function gameDaySlateReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "There is no active week for today’s Slate." };
  const day = easternDate(new Date());
  const { data: games, error } = await supabaseAdmin
    .from("games")
    .select("id, kickoff_at")
    .eq("scoring_period_id", period.id)
    .not("status", "in", "(postponed,cancelled,no_contest)");
  if (error) throw new Error("Today’s Slate could not be checked before sending a reminder.");
  const today = (games ?? []).filter((game) => easternDate(new Date(game.kickoff_at)) === day);
  if (!today.length) return { ready: false, reason: "There are no games on today’s Slate." };
  return await hasOfficialLines(today.map((game) => game.id))
    ? { ready: true, reason: null }
    : { ready: false, reason: "Today’s official lines are still being finalized." };
}

async function earlyLockReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "There is no active week for the international-game reminder." };
  const { data: game, error } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("scoring_period_id", period.id)
    .eq("is_international", true)
    .lte("line_lock_at", new Date().toISOString())
    .not("status", "in", "(postponed,cancelled,no_contest)")
    .order("line_lock_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("The international game could not be checked before sending a reminder.");
  if (!game) return { ready: false, reason: "The international game has not reached its official lock time." };
  return await hasOfficialLines([game.id])
    ? { ready: true, reason: null }
    : { ready: false, reason: "The international official line is still being finalized." };
}

async function recapReady(): Promise<ReminderReadiness> {
  const period = await findLatestSettledWeeklyRecapPeriod();
  if (!period) return { ready: false, reason: "The completed week has not been finalized yet." };
  return { ready: true, reason: null };
}

async function playoffDayRecapReady(): Promise<ReminderReadiness> {
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id")
    .eq("period_type", "playoff")
    .in("status", ["active", "complete"])
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (periodError) throw new Error("The playoff day could not be checked before sending a recap.");
  if (!period) return { ready: false, reason: "A playoff round is not active yet." };

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, kickoff_at, status")
    .eq("scoring_period_id", period.id)
    .lte("kickoff_at", new Date().toISOString());
  if (gamesError) throw new Error("Playoff scores could not be checked before sending a recap.");
  if (!(games ?? []).length) return { ready: false, reason: "No playoff games have started yet." };
  const latestDay = (games ?? []).reduce((latest, game) => easternDate(new Date(game.kickoff_at)) > latest ? easternDate(new Date(game.kickoff_at)) : latest, easternDate(new Date(games![0].kickoff_at)));
  const dayGames = (games ?? []).filter((game) => easternDate(new Date(game.kickoff_at)) === latestDay);
  if (dayGames.some((game) => game.status !== "final")) return { ready: false, reason: "The latest playoff day is still in progress." };
  const { count, error: picksError } = await supabaseAdmin
    .from("picks")
    .select("id", { count: "exact", head: true })
    .in("game_id", dayGames.map((game) => game.id))
    .eq("result", "pending");
  if (picksError) throw new Error("Playoff grades could not be checked before sending a recap.");
  return isPlayoffDayRecapReady({
    period,
    games: games ?? [],
    pendingAtsCount: count ?? 0,
    now: new Date(),
    easternDay: (value: string) => easternDate(new Date(value)),
  });
}

async function playoffPublicRevealReady(): Promise<ReminderReadiness> {
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id")
    .eq("period_type", "playoff")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (periodError) throw new Error("The playoff kickoff window could not be checked before sending a public update.");
  if (!period) return { ready: false, reason: "A playoff round is not active yet." };

  const { count, error } = await supabaseAdmin
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("scoring_period_id", period.id)
    .lte("kickoff_at", new Date().toISOString())
    .not("status", "in", "(postponed,cancelled,no_contest)");
  if (error) throw new Error("The playoff kickoff window could not be checked before sending a public update.");
  return (count ?? 0) > 0
    ? { ready: true, reason: null }
    : { ready: false, reason: "The selected playoff window has not reached kickoff yet." };
}

function isFeaturedKickoff(game: { is_international: boolean; kickoff_at: string }) {
  if (game.is_international) return true;
  const weekday = easternWeekday(game.kickoff_at);
  const hour = easternHour(game.kickoff_at);
  return weekday === "Wednesday" || weekday === "Thursday" || weekday === "Monday" || (weekday === "Sunday" && hour >= 20);
}

async function featuredWindowRevealReady(): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "There is no active week for the featured-game reveal." };
  const { data: games, error } = await supabaseAdmin
    .from("games")
    .select("kickoff_at, is_international, status")
    .eq("scoring_period_id", period.id);
  if (error) throw new Error("Featured kickoff status could not be checked before sending a reveal.");
  const hasStartedFeaturedGame = (games ?? []).some((game) =>
    isFeaturedKickoff(game) && new Date(game.kickoff_at) <= new Date() && !["postponed", "cancelled", "no_contest"].includes(game.status),
  );
  return hasStartedFeaturedGame
    ? { ready: true, reason: null }
    : { ready: false, reason: "The selected primetime or international game has not reached kickoff yet." };
}

function easternWeekday(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(value));
}

function easternHour(value: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));
}

async function sundayRevealReady(window: "early" | "late"): Promise<ReminderReadiness> {
  const period = await activePeriod();
  if (!period) return { ready: false, reason: "There is no active week for the Sunday reveal." };
  const { data: games, error } = await supabaseAdmin
    .from("games")
    .select("kickoff_at, status")
    .eq("scoring_period_id", period.id);
  if (error) throw new Error("Sunday kickoff status could not be checked before sending a reveal.");
  return isSundayWindowReady({
    activePeriod: period,
    games: games ?? [],
    window,
    now: new Date(),
    easternWeekday,
    easternHour,
  });
}

export async function reminderReadiness(category: ReminderCategory): Promise<ReminderReadiness> {
  if (category === "weekly") return freshSlateReady();
  if (category === "final_lines" || category === "sunday_final_lines") return gameDaySlateReady();
  if (category === "early_lock") return earlyLockReady();
  if (category === "weekly_recap") return recapReady();
  if (category === "playoff_day_recap") return playoffDayRecapReady();
  if (category === "playoff_public_reveal") return playoffPublicRevealReady();
  if (category === "featured_window_reveal") return featuredWindowRevealReady();
  if (category === "sunday_early_reveal") return sundayRevealReady("early");
  if (category === "sunday_late_reveal") return sundayRevealReady("late");
  return { ready: true, reason: null };
}
