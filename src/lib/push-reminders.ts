import webpush from "web-push";
import { deliverEmailReminder } from "@/lib/email-reminders";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ReminderCategory = "weekly" | "final_lines" | "pick_due" | "weekly_recap" | "ats_due" | "survivor_due" | "custom";
export type ReminderAudience = "all_active" | "pick_due" | "ats_due" | "survivor_due";

type Reminder = {
  id: string;
  category: ReminderCategory;
  audience: ReminderAudience;
  title: string;
  body: string;
};

type Subscription = {
  id: string;
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let configured = false;

function configureWebPush() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Browser push keys are not configured.");
  webpush.setVapidDetails("https://pickemjb.vercel.app", publicKey, privateKey);
  configured = true;
}

function preferenceColumn(category: ReminderCategory) {
  return {
    weekly: "push_weekly_enabled",
    final_lines: "push_final_lines_enabled",
    pick_due: "push_pick_due_enabled",
    weekly_recap: "push_weekly_recap_enabled",
    ats_due: "push_ats_due_enabled",
    survivor_due: "push_survivor_due_enabled",
    custom: "push_custom_enabled",
  }[category];
}

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
      if (pick.result !== "void") counts.set(pick.player_id, (counts.get(pick.player_id) ?? 0) + 1);
    }
    return activeIds.filter((playerId) => (counts.get(playerId) ?? 0) < period.max_picks);
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
    .in("survivor_entry_id", entryIds);
  if (survivorError) throw new Error("Survivor pick status could not be read.");
  const pickedEntryIds = new Set((survivorPicks ?? []).map((pick) => pick.survivor_entry_id));
  const survivorPlayersDue = (entries ?? [])
    .filter((entry) => !pickedEntryIds.has(entry.id))
    .map((entry) => entry.player_id);
  if (audience === "survivor_due") return survivorPlayersDue;

  // A courteous "still need to act" check never names a particular pool. A
  // player receives it only if either their ATS card or active Survivor entry is due.
  const atsDue = await atsPlayersDue();
  return [...new Set([...atsDue, ...survivorPlayersDue])];
}

async function subscriptionsForReminder(reminder: Reminder) {
  const playerIds = await eligiblePlayerIds(reminder.audience);
  if (playerIds.length === 0) return [] as Subscription[];
  const preference = preferenceColumn(reminder.category);
  const { data: players, error: playerError } = await supabaseAdmin
    .from("players")
    .select(`id, ${preference}`)
    .in("id", playerIds);
  if (playerError) throw new Error("Player reminder choices could not be read.");
  const enabledIds = ((players ?? []) as unknown as Array<{ id: string } & Record<string, boolean | null>>)
    .filter((player) => player[preference] === true)
    .map((player) => player.id);
  if (enabledIds.length === 0) return [] as Subscription[];
  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, player_id, endpoint, p256dh, auth")
    .in("player_id", enabledIds);
  if (error) throw new Error("Browser subscriptions could not be read.");
  return (data ?? []) as Subscription[];
}

async function recordAndSend(reminder: Reminder, subscription: Subscription) {
  const { data: delivery, error: createError } = await supabaseAdmin
    .from("push_reminder_deliveries")
    .insert({ reminder_id: reminder.id, player_id: subscription.player_id, subscription_id: subscription.id })
    .select("id")
    .maybeSingle();
  if (createError?.code === "23505") return { skipped: true, sent: false, failed: false };
  if (createError || !delivery) throw new Error("A reminder delivery receipt could not be created.");

  try {
    configureWebPush();
    const response = await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ title: reminder.title, body: reminder.body, url: "/", tag: `pickem-${reminder.id}` }),
      { TTL: 60 * 60 * 12 },
    );
    await supabaseAdmin.from("push_reminder_deliveries").update({
      status: "sent",
      provider_status: response.statusCode,
      delivered_at: new Date().toISOString(),
    }).eq("id", delivery.id);
    return { skipped: false, sent: true, failed: false };
  } catch (reason) {
    const statusCode = typeof reason === "object" && reason && "statusCode" in reason
      ? Number((reason as { statusCode?: unknown }).statusCode) : null;
    const expired = statusCode === 404 || statusCode === 410;
    await supabaseAdmin.from("push_reminder_deliveries").update({
      status: expired ? "expired" : "failed",
      provider_status: statusCode,
      error_message: expired ? "The browser subscription expired." : "The push provider rejected the delivery.",
    }).eq("id", delivery.id);
    if (expired) await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
    return { skipped: false, sent: false, failed: true };
  }
}

export async function deliverPushReminder(reminder: Reminder, limitedSubscriptions?: Subscription[]) {
  const subscriptions = limitedSubscriptions ?? await subscriptionsForReminder(reminder);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const subscription of subscriptions) {
    const result = await recordAndSend(reminder, subscription);
    sent += Number(result.sent);
    failed += Number(result.failed);
    skipped += Number(result.skipped);
  }
  return { recipients: subscriptions.length, sent, failed, skipped };
}

export async function sendDuePushReminders() {
  const { data: reminders, error } = await supabaseAdmin.rpc("claim_due_push_reminders");
  if (error) throw new Error("Due browser reminders could not be claimed.");
  const result = { reminders: 0, sent: 0, failed: 0, skipped: 0, emailSent: 0, emailFailed: 0 };
  for (const reminder of (reminders ?? []) as Reminder[]) {
    const [delivery, emailDelivery] = await Promise.all([
      deliverPushReminder(reminder),
      deliverEmailReminder(reminder),
    ]);
    await supabaseAdmin.from("push_reminders").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", reminder.id);
    result.reminders += 1;
    result.sent += delivery.sent;
    result.failed += delivery.failed;
    result.skipped += delivery.skipped;
    result.emailSent += emailDelivery.sent;
    result.emailFailed += emailDelivery.failed;
  }
  return result;
}
