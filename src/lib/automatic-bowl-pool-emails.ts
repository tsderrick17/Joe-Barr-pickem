import { bowlDailyRecapAt, bowlGamedays, unpickedBowlReminderAt } from "@/lib/bowl-email-schedule.js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { easternDateKey as easternDate } from "@/lib/eastern-time.js";

type BowlGame = { id: string; kickoff_at: string; line_lock_at: string; status: string };

function displayDay(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric",
  }).format(new Date(`${day}T12:00:00-05:00`));
}

async function commissionerId(signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { data, error } = await supabaseAdmin.from("players").select("id")
    .eq("active", true).eq("is_commissioner", true).order("created_at").limit(1).maybeSingle();
  signal?.throwIfAborted();
  if (error || !data) throw new Error("A Bowl Pool email needs an active commissioner sender.");
  return data.id;
}

async function queue(message: Record<string, unknown>, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { error } = await supabaseAdmin.from("push_reminders").insert(message);
  signal?.throwIfAborted();
  if (error?.code === "23505") return false;
  if (error) throw new Error("A Bowl Pool email could not be queued.");
  return true;
}

/** Queue immutable Bowl emails. Delivery remains guarded by readiness checks. */
export async function ensureAutomaticBowlPoolEmails(now = new Date(), signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { data: seasons, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons")
    .select("id, status").in("status", ["open", "live", "complete"]);
  signal?.throwIfAborted();
  if (seasonError) throw new Error("Bowl Pool season status could not be read.");
  if (!(seasons ?? []).length) return { created: 0, reason: "no_active_bowl_season" };

  const senderId = await commissionerId(signal);
  let created = 0;
  for (const season of seasons ?? []) {
    signal?.throwIfAborted();
    const { data, error } = await supabaseAdmin.from("bowl_pool_games")
      .select("id, kickoff_at, line_lock_at, status").eq("season_id", season.id).order("kickoff_at");
    signal?.throwIfAborted();
    if (error) throw new Error("Bowl Pool games could not be read for email scheduling.");
    const games = (data ?? []) as BowlGame[];
    for (const day of bowlGamedays(games)) {
      signal?.throwIfAborted();
      const dayGames = games.filter((game) => easternDate(new Date(game.kickoff_at)) === day);
      const scheduledFor = dayGames.map((game) => game.line_lock_at).sort()[0];
      if (!scheduledFor) continue;
      if (await queue({
        created_by_player_id: senderId, category: "bowl_line_lock", audience: "all_active",
        title: "Bowl Pool lines are set", body: "The official lines are posted for today's Bowl Pool games. Review your selections before kickoff.",
        scheduled_for: scheduledFor, source_game_ids: dayGames.map((game) => game.id),
        automation_key: `bowl:${season.id}:line-lock:${day}`,
      }, signal)) created += 1;
    }
    for (const game of games.filter((item) => item.status === "scheduled" && new Date(item.kickoff_at) > now)) {
      signal?.throwIfAborted();
      const scheduledFor = unpickedBowlReminderAt(game.kickoff_at);
      if (new Date(scheduledFor) <= now) continue;
      if (await queue({
        created_by_player_id: senderId, category: "bowl_pick_due", audience: "all_active",
        title: "Bowl Pool pick due soon", body: "You still have a Bowl Pool selection to make before kickoff.",
        scheduled_for: scheduledFor, source_game_ids: [game.id],
        automation_key: `bowl:${season.id}:pick-due:${game.id}`,
      }, signal)) created += 1;
    }
    for (const day of bowlGamedays(games)) {
      signal?.throwIfAborted();
      const scheduledFor = bowlDailyRecapAt(day);
      if (new Date(scheduledFor) > now) continue;
      const dayGames = games.filter((game) => easternDate(new Date(game.kickoff_at)) === day);
      if (!dayGames.length) continue;
      if (await queue({
        created_by_player_id: senderId, category: "bowl_daily_recap", audience: "all_active",
        title: `Bowl Pool recap: ${displayDay(day)}`,
        body: "Yesterday's Bowl Pool results and standings are ready.",
        scheduled_for: scheduledFor, source_game_ids: dayGames.map((game) => game.id),
        automation_key: `bowl:${season.id}:daily-recap:${day}`,
      }, signal)) created += 1;
    }
  }
  return { created, reason: null };
}
