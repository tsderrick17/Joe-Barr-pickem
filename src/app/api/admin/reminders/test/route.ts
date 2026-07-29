import { NextRequest, NextResponse } from "next/server";
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
    body: "Email reminders are working for your Pick'em account.",
    scheduled_for: new Date().toISOString(),
    status: "test",
    sent_at: new Date().toISOString(),
  }).select("id, category, audience, title, body").single();
  if (reminderError) return NextResponse.json({ error: "Test reminder could not be prepared." }, { status: 500 });
  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("notification_email, email_notifications_enabled")
    .eq("id", commissioner.id)
    .single();
  if (playerError) return NextResponse.json({ error: "Your email preferences could not be checked." }, { status: 500 });
  if (!(player.email_notifications_enabled && player.notification_email)) {
    return NextResponse.json({ error: "Turn on email reminders in Preferences before sending a test." }, { status: 409 });
  }
  const email = await deliverEmailTest(reminder, commissioner.id, player.notification_email);
  return NextResponse.json({
    message: `Test email sent: ${email.sent} delivery.`,
    email,
  });
}
