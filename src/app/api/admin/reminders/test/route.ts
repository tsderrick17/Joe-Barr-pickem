import { NextRequest, NextResponse } from "next/server";
import { deliverPushReminder } from "@/lib/push-reminders";
import { deliverEmailTest } from "@/lib/email-reminders";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const commissioner = await requireCommissioner(request);
  if (!commissioner) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data: reminder, error: reminderError } = await supabaseAdmin.from("push_reminders").insert({
    created_by_player_id: commissioner.id,
    category: "custom",
    audience: "all_active",
    title: "Joe Barr Pick'em test",
    body: "Browser reminders are working on this device.",
    scheduled_for: new Date().toISOString(),
    status: "test",
    sent_at: new Date().toISOString(),
  }).select("id, category, audience, title, body").single();
  if (reminderError) return NextResponse.json({ error: "Test reminder could not be prepared." }, { status: 500 });
  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, player_id, endpoint, p256dh, auth")
    .eq("player_id", commissioner.id);
  if (subscriptionError) return NextResponse.json({ error: "Your browser subscription could not be checked." }, { status: 500 });
  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("notification_email, email_notifications_enabled")
    .eq("id", commissioner.id)
    .single();
  if (playerError) return NextResponse.json({ error: "Your email preferences could not be checked." }, { status: 500 });
  if (!subscriptions?.length && !(player.email_notifications_enabled && player.notification_email)) {
    return NextResponse.json({ error: "Turn on browser or email reminders in Preferences before sending a test." }, { status: 409 });
  }
  const [push, email] = await Promise.all([
    subscriptions?.length ? deliverPushReminder(reminder, subscriptions) : Promise.resolve({ sent: 0, failed: 0 }),
    player.email_notifications_enabled && player.notification_email
      ? deliverEmailTest(reminder, commissioner.id, player.notification_email)
      : Promise.resolve({ sent: 0, failed: 0 }),
  ]);
  return NextResponse.json({
    message: `Test sent: ${push.sent} browser delivery and ${email.sent} email delivery.`,
    push,
    email,
  });
}
