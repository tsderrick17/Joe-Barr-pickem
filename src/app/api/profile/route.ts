import { NextRequest, NextResponse } from "next/server";
import { authenticatedProfilePlayer } from "@/lib/authenticated-profile-player";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  return NextResponse.json({
    notificationEmail: player.notification_email ?? "",
    emailNotificationsEnabled: player.email_notifications_enabled,
    emailWeeklyEnabled: player.email_weekly_enabled,
    emailFinalLinesEnabled: player.email_final_lines_enabled,
    emailSundayFinalLinesEnabled: player.email_sunday_final_lines_enabled,
    emailEarlyLockEnabled: player.email_early_lock_enabled,
    emailPickDueEnabled: player.email_pick_due_enabled,
    emailWeeklyRecapEnabled: player.email_weekly_recap_enabled,
    emailPlayoffDayRecapEnabled: player.email_playoff_day_recap_enabled,
    emailAtsDueEnabled: player.email_ats_due_enabled,
    emailSurvivorDueEnabled: player.email_survivor_due_enabled,
    emailSundayEarlyRevealEnabled: player.email_sunday_early_reveal_enabled,
    emailSundayLateRevealEnabled: player.email_sunday_late_reveal_enabled,
    emailFeaturedWindowRevealEnabled: player.email_featured_window_reveal_enabled,
    emailCustomEnabled: player.email_custom_enabled,
  });
}

export async function PUT(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  let body: { notificationEmail?: unknown; emailNotificationsEnabled?: unknown; emailWeeklyEnabled?: unknown; emailFinalLinesEnabled?: unknown; emailSundayFinalLinesEnabled?: unknown; emailEarlyLockEnabled?: unknown; emailPickDueEnabled?: unknown; emailWeeklyRecapEnabled?: unknown; emailPlayoffDayRecapEnabled?: unknown; emailAtsDueEnabled?: unknown; emailSurvivorDueEnabled?: unknown; emailSundayEarlyRevealEnabled?: unknown; emailSundayLateRevealEnabled?: unknown; emailFeaturedWindowRevealEnabled?: unknown; emailCustomEnabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your notification settings were incomplete." }, { status: 400 });
  }

  const email = typeof body.notificationEmail === "string"
    ? body.notificationEmail.trim().toLowerCase()
    : "";
  const preference = (value: unknown, current: boolean) => typeof value === "boolean" ? value : current;
  const everyGameDayLines = preference(body.emailFinalLinesEnabled, player.email_final_lines_enabled);

  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("players")
    .update({
      notification_email: email || null,
      email_notifications_enabled: email ? preference(body.emailNotificationsEnabled, player.email_notifications_enabled) : false,
      email_weekly_enabled: preference(body.emailWeeklyEnabled, player.email_weekly_enabled),
      email_final_lines_enabled: everyGameDayLines,
      email_sunday_final_lines_enabled: everyGameDayLines
        ? false
        : preference(body.emailSundayFinalLinesEnabled, player.email_sunday_final_lines_enabled),
      email_early_lock_enabled: preference(body.emailEarlyLockEnabled, player.email_early_lock_enabled),
      email_pick_due_enabled: preference(body.emailPickDueEnabled, player.email_pick_due_enabled),
      email_weekly_recap_enabled: preference(body.emailWeeklyRecapEnabled, player.email_weekly_recap_enabled),
      email_playoff_day_recap_enabled: preference(body.emailPlayoffDayRecapEnabled, player.email_playoff_day_recap_enabled),
      email_ats_due_enabled: preference(body.emailAtsDueEnabled, player.email_ats_due_enabled),
      email_survivor_due_enabled: preference(body.emailSurvivorDueEnabled, player.email_survivor_due_enabled),
      email_sunday_early_reveal_enabled: preference(body.emailSundayEarlyRevealEnabled, player.email_sunday_early_reveal_enabled),
      email_sunday_late_reveal_enabled: preference(body.emailSundayLateRevealEnabled, player.email_sunday_late_reveal_enabled),
      email_featured_window_reveal_enabled: preference(body.emailFeaturedWindowRevealEnabled, player.email_featured_window_reveal_enabled),
      email_custom_enabled: true,
      notification_preferences_updated_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ message: "Notification settings saved." });
}
