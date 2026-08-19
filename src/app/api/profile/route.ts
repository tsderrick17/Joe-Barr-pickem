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
    senderEmail: process.env.BREVO_SENDER_EMAIL ?? "",
    emailNotificationsEnabled: player.email_notifications_enabled,
    emailWeeklyEnabled: player.email_weekly_enabled,
    emailFinalLinesEnabled: player.email_final_lines_enabled,
    emailSundayFinalLinesEnabled: player.email_sunday_final_lines_enabled,
    emailEarlyLockEnabled: player.email_early_lock_enabled,
    emailPickDueEnabled: player.email_pick_due_enabled,
    emailPickDueSundayEarlyEnabled: player.email_pick_due_sunday_early_enabled,
    emailPickDueSundayAfternoonEnabled: player.email_pick_due_sunday_afternoon_enabled,
    emailPickDuePrimetimeEnabled: player.email_pick_due_primetime_enabled,
    emailWeeklyRecapEnabled: player.email_weekly_recap_enabled,
    emailPlayoffDayRecapEnabled: player.email_playoff_day_recap_enabled,
    emailPlayoffPublicRevealEnabled: player.email_playoff_public_reveal_enabled,
    emailAtsDueEnabled: player.email_ats_due_enabled,
    emailSurvivorDueEnabled: player.email_survivor_due_enabled,
    emailSundayEarlyRevealEnabled: player.email_sunday_early_reveal_enabled,
    emailSundayLateRevealEnabled: player.email_sunday_late_reveal_enabled,
    emailFeaturedWindowRevealEnabled: player.email_featured_window_reveal_enabled,
    emailCustomEnabled: player.email_custom_enabled,
    showSurvivorStandings: player.show_survivor_standings,
    showPoolChat: player.show_pool_chat,
    hidePickemEliminatedRows: player.hide_pickem_eliminated_rows,
    hideSurvivorEliminatedRows: player.hide_survivor_eliminated_rows,
  });
}

export async function PUT(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) {
    return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });
  }

  let body: { notificationEmail?: unknown; emailNotificationsEnabled?: unknown; emailWeeklyEnabled?: unknown; emailFinalLinesEnabled?: unknown; emailSundayFinalLinesEnabled?: unknown; emailEarlyLockEnabled?: unknown; emailPickDueEnabled?: unknown; emailPickDueSundayEarlyEnabled?: unknown; emailPickDueSundayAfternoonEnabled?: unknown; emailPickDuePrimetimeEnabled?: unknown; emailWeeklyRecapEnabled?: unknown; emailPlayoffDayRecapEnabled?: unknown; emailPlayoffPublicRevealEnabled?: unknown; emailAtsDueEnabled?: unknown; emailSurvivorDueEnabled?: unknown; emailSundayEarlyRevealEnabled?: unknown; emailSundayLateRevealEnabled?: unknown; emailFeaturedWindowRevealEnabled?: unknown; emailCustomEnabled?: unknown; showSurvivorStandings?: unknown; showPoolChat?: unknown; hidePickemEliminatedRows?: unknown; hideSurvivorEliminatedRows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your notification settings were incomplete." }, { status: 400 });
  }

  const hasEmailUpdate = typeof body.notificationEmail === "string";
  const email = hasEmailUpdate
    ? (body.notificationEmail as string).trim().toLowerCase()
    : player.notification_email ?? "";
  const preference = (value: unknown, current: boolean) => typeof value === "boolean" ? value : current;
  const everyGameDayLines = preference(body.emailFinalLinesEnabled, player.email_final_lines_enabled);
  // A player can still have the previous page open during deployment. If it
  // submits the former single switch, apply that choice to all three groups.
  const legacyPickDue = typeof body.emailPickDueEnabled === "boolean" ? body.emailPickDueEnabled : null;
  const sundayEarlyDue = preference(body.emailPickDueSundayEarlyEnabled, legacyPickDue ?? player.email_pick_due_sunday_early_enabled);
  const sundayAfternoonDue = preference(body.emailPickDueSundayAfternoonEnabled, legacyPickDue ?? player.email_pick_due_sunday_afternoon_enabled);
  const primetimeDue = preference(body.emailPickDuePrimetimeEnabled, legacyPickDue ?? player.email_pick_due_primetime_enabled);

  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("players")
    .update({
      notification_email: hasEmailUpdate ? email || null : player.notification_email,
      email_notifications_enabled: hasEmailUpdate ? (email ? preference(body.emailNotificationsEnabled, player.email_notifications_enabled) : false) : player.email_notifications_enabled,
      email_weekly_enabled: preference(body.emailWeeklyEnabled, player.email_weekly_enabled),
      email_final_lines_enabled: everyGameDayLines,
      email_sunday_final_lines_enabled: everyGameDayLines
        ? false
        : preference(body.emailSundayFinalLinesEnabled, player.email_sunday_final_lines_enabled),
      email_early_lock_enabled: preference(body.emailEarlyLockEnabled, player.email_early_lock_enabled),
      // Keep the historical roll-up synchronized for old receipts and a safe
      // rollback while each automatic occurrence uses its specific choice.
      email_pick_due_enabled: sundayEarlyDue || sundayAfternoonDue || primetimeDue,
      email_pick_due_sunday_early_enabled: sundayEarlyDue,
      email_pick_due_sunday_afternoon_enabled: sundayAfternoonDue,
      email_pick_due_primetime_enabled: primetimeDue,
      email_weekly_recap_enabled: preference(body.emailWeeklyRecapEnabled, player.email_weekly_recap_enabled),
      email_playoff_day_recap_enabled: preference(body.emailPlayoffDayRecapEnabled, player.email_playoff_day_recap_enabled),
      email_playoff_public_reveal_enabled: preference(body.emailPlayoffPublicRevealEnabled, player.email_playoff_public_reveal_enabled),
      email_ats_due_enabled: preference(body.emailAtsDueEnabled, player.email_ats_due_enabled),
      email_survivor_due_enabled: preference(body.emailSurvivorDueEnabled, player.email_survivor_due_enabled),
      email_sunday_early_reveal_enabled: preference(body.emailSundayEarlyRevealEnabled, player.email_sunday_early_reveal_enabled),
      email_sunday_late_reveal_enabled: preference(body.emailSundayLateRevealEnabled, player.email_sunday_late_reveal_enabled),
      email_featured_window_reveal_enabled: preference(body.emailFeaturedWindowRevealEnabled, player.email_featured_window_reveal_enabled),
      email_custom_enabled: true,
      show_survivor_standings: preference(body.showSurvivorStandings, player.show_survivor_standings),
      show_pool_chat: preference(body.showPoolChat, player.show_pool_chat),
      hide_pickem_eliminated_rows: preference(body.hidePickemEliminatedRows, player.hide_pickem_eliminated_rows),
      hide_survivor_eliminated_rows: preference(body.hideSurvivorEliminatedRows, player.hide_survivor_eliminated_rows),
      notification_preferences_updated_at: new Date().toISOString(),
    })
    .eq("id", player.id);

  if (error) {
    return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ message: "Notification settings saved." });
}
