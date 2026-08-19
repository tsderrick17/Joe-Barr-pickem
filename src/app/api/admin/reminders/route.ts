import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data: reminders, error } = await supabaseAdmin
    .from("push_reminders")
    .select("id, category, audience, title, body, scheduled_for, status, suppression_reason, sent_at, cancelled_at, created_at, email_reminder_deliveries(status)")
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
        suppressionReason: reminder.suppression_reason,
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
