import { bowlDailyRecapAt, bowlGamedays, unpickedBowlReminderAt } from "@/lib/bowl-email-schedule.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

type BowlGame = { id: string; kickoff_at: string; status: string };

function easternDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

function displayDay(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric",
  }).format(new Date(`${day}T12:00:00-05:00`));
}

async function commissionerId() {
  const { data, error } = await supabaseAdmin.from("players").select("id")
    .eq("active", true).eq("is_commissioner", true).order("created_at").limit(1).maybeSingle();
  if (error || !data) throw new Error("A Bowl Pool email needs an active commissioner sender.");
  return data.id;
}

async function queue(message: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("push_reminders").insert(message);
  if (error?.code === "23505") return false;
  if (error) throw new Error("A Bowl Pool email could not be queued.");
  return true;
}

/** Queue immutable Bowl emails. Delivery remains guarded by readiness checks. */
export async function ensureAutomaticBowlPoolEmails(now = new Date()) {
  const { data: seasons, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons")
    .select("id, status").in("status", ["open", "live", "complete"]);
  if (seasonError) throw new Error("Bowl Pool season status could not be read.");
  if (!(seasons ?? []).length) return { created: 0, reason: "no_active_bowl_season" };

  const senderId = await commissionerId();
  let created = 0;
  for (const season of seasons ?? []) {
    const { data, error } = await supabaseAdmin.from("bowl_pool_games")
      .select("id, kickoff_at, status").eq("season_id", season.id).order("kickoff_at");
    if (error) throw new Error("Bowl Pool games could not be read for email scheduling.");
    const games = (data ?? []) as BowlGame[];
    for (const game of games.filter((item) => item.status === "scheduled" && new Date(item.kickoff_at) > now)) {
      const scheduledFor = unpickedBowlReminderAt(game.kickoff_at);
      if (new Date(scheduledFor) <= now) continue;
      if (await queue({
        created_by_player_id: senderId, category: "bowl_pick_due", audience: "all_active",
        title: "Bowl Pool pick due soon", body: "You still have a Bowl Pool selection to make before kickoff.",
        scheduled_for: scheduledFor, source_game_ids: [game.id],
        automation_key: `bowl:${season.id}:pick-due:${game.id}`,
      })) created += 1;
    }
    for (const day of bowlGamedays(games)) {
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
      })) created += 1;
    }
  }
  return { created, reason: null };
}
