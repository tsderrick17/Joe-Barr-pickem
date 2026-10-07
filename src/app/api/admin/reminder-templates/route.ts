import { NextRequest, NextResponse } from "next/server";
import { reminderTemplate } from "@/lib/reminder-templates";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailArtworkOptions } from "@/lib/email-artwork-options";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  const { data, error } = await supabaseAdmin.from("reminder_templates").select("template_id, title, body, image_options");
  if (error) return NextResponse.json({ error: "Standard email wording could not be loaded." }, { status: 500 });
  return NextResponse.json({ templates: (data ?? []).map((template) => ({ id: template.template_id, title: template.title, body: template.body, imageOptions: emailArtworkOptions(template.image_options) })) });
}

export async function PUT(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  const commissioner = access.player;
  let body: { id?: unknown; title?: unknown; message?: unknown; imageOptions?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Standard email wording was incomplete." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!reminderTemplate(id) || !title || title.length > 80 || !message || message.length > 220) return NextResponse.json({ error: "Use a standard email, a subject up to 80 characters, and a message up to 220 characters." }, { status: 400 });
  const { error } = await supabaseAdmin.from("reminder_templates").upsert({ template_id: id, title, body: message, ...(body.imageOptions ? { image_options: emailArtworkOptions(body.imageOptions) } : {}), updated_by_player_id: commissioner.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Standard email wording could not be saved." }, { status: 500 });
  return NextResponse.json({ message: "Standard email wording saved." });
}

export async function DELETE(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!reminderTemplate(id)) return NextResponse.json({ error: "Choose a standard email to reset." }, { status: 400 });
  const { error } = await supabaseAdmin.from("reminder_templates").delete().eq("template_id", id);
  if (error) return NextResponse.json({ error: "Standard email wording could not be reset." }, { status: 500 });
  return NextResponse.json({ message: "Standard wording restored." });
}
