import { bowlDailyRecapAt, bowlGamedays, unpickedBowlReminderAt } from "@/lib/bowl-email-schedule.js";
import { bowlLastCallAt, bowlLastCallMessage, bowlOpeningAnnouncementAt, bowlOpeningMessage } from "@/lib/bowl-opening-announcement.js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Database } from "@/lib/database.types";
import { easternDateKey as easternDate } from "@/lib/eastern-time.js";
import { dateFormat } from "./date-format.js";

type BowlGame = { id: string; bowl_name: string | null; kickoff_at: string; line_lock_at: string; status: string; time_confirmed: boolean | null };

function displayDay(day: string) {
  return dateFormat("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric",
  }).format(new Date(`${day}T12:00:00-05:00`));
}

async function commissionerId() {
  const { data, error } = await supabaseAdmin.from("players").select("id")
    .eq("active", true).eq("is_commissioner", true).order("created_at").limit(1).maybeSingle();
  if (error || !data) throw new Error("A Bowl Pool email needs an active commissioner sender.");
  return data.id;
}

async function queue(message: Database["public"]["Tables"]["push_reminders"]["Insert"]) {
  const { error } = await supabaseAdmin.from("push_reminders").insert(message);
  if (error?.code === "23505") return false;
  if (error) throw new Error("A Bowl Pool email could not be queued.");
  return true;
}

/** Queue immutable Bowl emails. Delivery remains guarded by readiness checks. */
export async function ensureAutomaticBowlPoolEmails(now = new Date()) {
  const { data: seasons, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons")
    .select("id, status, season_year, championship_game_id").in("status", ["open", "live", "complete"]);
  if (seasonError) throw new Error("Bowl Pool season status could not be read.");
  if (!(seasons ?? []).length) return { created: 0, reason: "no_active_bowl_season" };

  const senderId = await commissionerId();
  let created = 0;
  for (const season of seasons ?? []) {
    const { data, error } = await supabaseAdmin.from("bowl_pool_games")
      .select("id, bowl_name, kickoff_at, line_lock_at, status, time_confirmed").eq("season_id", season.id).order("kickoff_at");
    if (error) throw new Error("Bowl Pool games could not be read for email scheduling.");
    const games = (data ?? []) as BowlGame[];
    for (const day of bowlGamedays(games)) {
      const dayGames = games.filter((game) => easternDate(new Date(game.kickoff_at)) === day);
      const scheduledFor = dayGames.map((game) => game.line_lock_at).sort()[0];
      if (!scheduledFor) continue;
      if (await queue({
        created_by_player_id: senderId, category: "bowl_line_lock", audience: "all_active",
        title: "Bowl Pool lines are set", body: "The official lines are posted for today's Bowl Pool games. Review your selections before kickoff.",
        scheduled_for: scheduledFor, source_game_ids: dayGames.map((game) => game.id),
        automation_key: `bowl:${season.id}:line-lock:${day}`,
      })) created += 1;
    }
    // A game whose time ESPN has not announced has only a placeholder on its day: no reminder counts down to it until the real time arrives.
    for (const game of games.filter((item) => item.status === "scheduled" && item.time_confirmed !== false && new Date(item.kickoff_at) > now)) {
      const scheduledFor = unpickedBowlReminderAt(game.kickoff_at);
      if (new Date(scheduledFor) <= now) continue;
      if (await queue({
        created_by_player_id: senderId, category: "bowl_pick_due", audience: "all_active",
        title: "Bowl Pool pick due soon", body: "You still have a Bowl Pool selection to make before kickoff.",
        scheduled_for: scheduledFor, source_game_ids: [game.id],
        automation_key: `bowl:${season.id}:pick-due:${game.id}`,
      })) created += 1;
    }
    // The one-time "the Bowl Pool is open" email and phone notification. It is queued the morning it is due, so its words come from the schedule as
    // it stands then, and only while seats can still be claimed (no game has kicked off).
    const openingAt = typeof season.season_year === "number" ? bowlOpeningAnnouncementAt(season.season_year) : null;
    if (openingAt && season.status !== "complete" && new Date(openingAt) <= now && !games.some((game) => new Date(game.kickoff_at) <= now)) {
      const first = games.filter((game) => game.status === "scheduled").sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
      if (first) {
        const finalGame = games.find((game) => game.id === season.championship_game_id);
        const message = bowlOpeningMessage({ seasonYear: season.season_year, firstGame: first, finalGameKickoffAt: finalGame?.kickoff_at ?? null });
        if (await queue({
          created_by_player_id: senderId, category: "bowl_pool_open", audience: "all_active",
          title: message.title, body: message.body, recap_snapshot: message.snapshot,
          scheduled_for: openingAt, source_game_ids: [first.id], automation_key: `bowl:${season.id}:open`,
        })) created += 1;
      }
    }
    // The one-time "last call" email and phone notification, 24 hours before the first kickoff, for the players who have not joined. Like the opening
    // announcement it is queued when it comes due, from the first game as it stands then; it needs a confirmed kickoff time to count back from.
    const firstGame = games.filter((game) => game.status === "scheduled").sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
    if (firstGame && firstGame.time_confirmed !== false && season.status !== "complete" && !games.some((game) => new Date(game.kickoff_at) <= now)) {
      const lastCallAt = bowlLastCallAt(firstGame.kickoff_at);
      if (new Date(lastCallAt) <= now) {
        const message = bowlLastCallMessage({ firstGame });
        if (await queue({
          created_by_player_id: senderId, category: "bowl_pool_last_call", audience: "all_active",
          title: message.title, body: message.body, recap_snapshot: message.snapshot,
          scheduled_for: lastCallAt, source_game_ids: [firstGame.id], automation_key: `bowl:${season.id}:last-call`,
        })) created += 1;
      }
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
