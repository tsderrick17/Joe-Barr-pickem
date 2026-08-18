import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

const categories = new Set(["weekly", "final_lines", "sunday_final_lines", "early_lock", "pick_due", "weekly_recap", "playoff_day_recap", "playoff_public_reveal", "sunday_early_reveal", "sunday_late_reveal", "featured_window_reveal", "ats_due", "survivor_due", "custom"]);
const audiences = new Set(["all_active", "pick_due", "ats_due", "survivor_due"]);

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data: reminders, error } = await supabaseAdmin
    .from("push_reminders")
    .select("id, category, audience, title, body, scheduled_for, status, sent_at, cancelled_at, created_at, email_reminder_deliveries(status)")
    .order("scheduled_for", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "Reminder history could not be loaded." }, { status: 500 });

  return NextResponse.json({
    reminders: (reminders ?? []).map((reminder) => {
      const emailDeliveries = (reminder.email_reminder_deliveries ?? []) as Array<{ status: string }>;
      return {
        id: reminder.id,
        category: reminder.category,
        audience: reminder.audience,
        title: reminder.title,
        body: reminder.body,
        scheduledFor: reminder.scheduled_for,
        status: reminder.status,
        sentAt: reminder.sent_at,
        cancelledAt: reminder.cancelled_at,
        createdAt: reminder.created_at,
        emailDelivered: emailDeliveries.filter((delivery) => delivery.status === "sent").length,
        emailFailed: emailDeliveries.filter((delivery) => delivery.status === "failed").length,
        emailSuppressed: emailDeliveries.filter((delivery) => delivery.status === "suppressed").length,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const commissioner = await requireCommissioner(request);
  if (!commissioner) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  let body: { category?: unknown; audience?: unknown; title?: unknown; message?: unknown; scheduledFor?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Reminder details were incomplete." }, { status: 400 }); }
  const category = typeof body.category === "string" ? body.category : "";
  const audience = typeof body.audience === "string" ? body.audience : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const scheduledFor = typeof body.scheduledFor === "string" ? new Date(body.scheduledFor) : null;
  if (!categories.has(category) || !audiences.has(audience) || !title || title.length > 80 || !message || message.length > 220 || !scheduledFor || Number.isNaN(scheduledFor.valueOf())) {
    return NextResponse.json({ error: "Enter a valid category, audience, message, and delivery time." }, { status: 400 });
  }
  if (scheduledFor.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Choose a future time or no more than one minute in the past." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("push_reminders").insert({
    created_by_player_id: commissioner.id,
    category,
    audience,
    title,
    body: message,
    scheduled_for: scheduledFor.toISOString(),
  }).select("id, scheduled_for").single();
  if (error) return NextResponse.json({ error: "Reminder could not be scheduled." }, { status: 500 });
  return NextResponse.json({ message: "Player reminder scheduled.", reminder: { id: data.id, scheduledFor: data.scheduled_for } });
}
