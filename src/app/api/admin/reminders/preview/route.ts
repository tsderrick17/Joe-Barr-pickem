import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reminderTemplate } from "@/lib/reminder-templates";
import { messageHtml } from "@/lib/email-reminders";
import { emailArtworkKinds, emailArtworkOptions, emailArtworkTemplateId } from "@/lib/email-artwork-options";
import { emailArtworkSample } from "@/lib/email-artwork-sample";
import { renderEmailArtwork, type EmailArtworkSnapshot } from "@/lib/email-artwork";
import { buildWeeklyRecapSnapshot, ensureWeeklyRecapSnapshot, ensurePlayoffDayRecapSnapshot, ensureFreshSlateSnapshot, ensureGameDaySlateSnapshot, ensureEarlyLockSnapshot, ensureSundayRevealSnapshot, ensureFeaturedWindowRevealSnapshot, ensurePlayoffPublicRevealSnapshot } from "@/lib/weekly-recap";
import { ensureBowlDailyRecapSnapshot, ensureBowlLineLockSnapshot } from "@/lib/bowl-pool-recap";
import type { ReminderCategory, ReminderAudience } from "@/lib/reminder-audience";
import { reminderReadiness } from "@/lib/reminder-readiness";
import { findLatestSettledWeeklyRecapPeriod } from "@/lib/weekly-recap-period";
import { automaticEmailSubject } from "@/lib/email-subjects.js";

export const maxDuration = 60;
const readOnly = { persist: false };
type Reminder = { id: string; category: ReminderCategory; audience: ReminderAudience; title: string; body: string; recap_snapshot: EmailArtworkSnapshot | null; source_scoring_period_id?: string | null; source_game_ids?: string[]; status?: string };

async function previewSnapshot(reminder: Reminder): Promise<EmailArtworkSnapshot | null> {
  if (reminder.recap_snapshot) return reminder.recap_snapshot;
  const id = reminder.id;
  // A pending recap cannot truthfully label unfinished selections as losses.
  if (reminder.category === "weekly_recap") {
    const period = await findLatestSettledWeeklyRecapPeriod();
    if (!period || (reminder.source_scoring_period_id && period.id !== reminder.source_scoring_period_id)) throw new Error("Results are not ready.");
  }
  const readiness = await reminderReadiness(reminder.category, reminder.source_game_ids, reminder.source_scoring_period_id);
  if (!readiness.ready) throw new Error(readiness.reason ?? "Email data is not ready.");
  switch (reminder.category) {
    case "weekly_recap": return ensureWeeklyRecapSnapshot(id, null, readOnly);
    case "playoff_day_recap": return ensurePlayoffDayRecapSnapshot(id, null, readOnly);
    case "weekly": return ensureFreshSlateSnapshot(id, null, readOnly);
    case "final_lines": case "sunday_final_lines": return ensureGameDaySlateSnapshot(id, null, readOnly);
    case "early_lock": return ensureEarlyLockSnapshot(id, null, readOnly);
    case "sunday_early_reveal": return ensureSundayRevealSnapshot(id, null, "early", readOnly);
    case "sunday_late_reveal": return ensureSundayRevealSnapshot(id, null, "late", readOnly);
    case "featured_window_reveal": return ensureFeaturedWindowRevealSnapshot(id, null, readOnly);
    case "playoff_public_reveal": return ensurePlayoffPublicRevealSnapshot(id, null, readOnly);
    case "bowl_daily_recap": return ensureBowlDailyRecapSnapshot(id, null, readOnly);
    case "bowl_line_lock": return ensureBowlLineLockSnapshot(id, null, readOnly);
    default: return null;
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Choose an email to preview." }, { status: 400 });
  const template = typeof input.templateId === "string" ? reminderTemplate(input.templateId) : null;
  let reminder: Reminder | null = null;
  if (typeof input.reminderId === "string") {
    const { data, error } = await supabaseAdmin.from("push_reminders").select("id, category, audience, title, body, recap_snapshot, source_scoring_period_id, source_game_ids, status").eq("id", input.reminderId).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "That email could not be loaded." }, { status: 404 });
    reminder = data as Reminder;
  } else if (template) {
    const { data, error } = await supabaseAdmin.from("push_reminders").select("id, category, audience, title, body, recap_snapshot, source_scoring_period_id, source_game_ids, status").eq("category", template.category).not("recap_snapshot", "is", null).order("scheduled_for", { ascending: false }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ error: "Recent email data could not be loaded." }, { status: 503 });
    reminder = data as Reminder | null;
  } else return NextResponse.json({ error: "Choose a standard email or a delivery receipt." }, { status: 400 });
  try {
    let snapshot = reminder?.recap_snapshot ?? null;
    let source = snapshot ? "Saved email data · rendered with the current artwork" : "Current data · values may change before delivery";
    let warning = "";
    if (!snapshot) {
      try {
        if (reminder) snapshot = await previewSnapshot(reminder);
        else if (template?.category === "weekly_recap") snapshot = await buildWeeklyRecapSnapshot();
      } catch {
        warning = "Final data is not ready. This is a layout sample, not the upcoming results.";
      }
    }
    const category = template?.category ?? reminder!.category;
    if (!snapshot) {
      snapshot = emailArtworkSample(category, template?.id === "weekly_recap_pickem_only");
      source = snapshot ? "Sample data · fictional players and results" : "Text-only email";
    }
    if (template?.id === "weekly_recap_pickem_only" && snapshot?.kind === "weekly_recap") snapshot = { ...snapshot, survivor: { ...snapshot.survivor, in: 0, championCrownedInRecapWeek: false } };
    const templateId = template?.id ?? emailArtworkTemplateId(category, snapshot);
    const { data: saved } = await supabaseAdmin.from("reminder_templates").select("title, body, image_options").eq("template_id", templateId).maybeSingle();
    const options = emailArtworkOptions(input.imageOptions ?? saved?.image_options);
    const rawTitle = typeof input.title === "string" ? input.title.slice(0, 80) : template ? saved?.title ?? template.title : reminder!.title;
    const title = template ? automaticEmailSubject({ templateId, title: rawTitle, periodName: snapshot && "week" in snapshot ? snapshot.week : snapshot && "round" in snapshot ? snapshot.round : null, eventAt: snapshot && "generatedAt" in snapshot ? snapshot.generatedAt : null, matchupLabel: snapshot && "matchup" in snapshot ? snapshot.matchup : null }) : rawTitle;
    const body = typeof input.message === "string" ? input.message.slice(0, 220) : template ? saved?.body ?? template.body : reminder!.body;
    let html = messageHtml({ id: reminder?.id ?? "preview", category, audience: template?.audience ?? reminder!.audience, title, body, recap_snapshot: snapshot, imageOptions: options });
    const images = [];
    for (const kind of emailArtworkKinds(category, snapshot)) {
      if (!snapshot) continue;
      const rendered = await renderEmailArtwork(snapshot, kind, options);
      const src = "data:image/png;base64," + Buffer.from(await rendered.arrayBuffer()).toString("base64");
      images.push({ kind, src });
      html = html.replace(new RegExp('https://pickemjb\\.vercel\\.app/api/recap-image\\?[^"]*&kind=' + kind + '&[^"]*', "g"), src);
    }
    return NextResponse.json({ html, images, source, warning, templateId, imageOptions: options }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("email preview render failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The image could not be rendered. Nothing was sent. Try again after checking the email data." }, { status: 500 });
  }
}
