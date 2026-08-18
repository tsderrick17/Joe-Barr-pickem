import { NextRequest, NextResponse } from "next/server";
import { reminderTemplate } from "@/lib/reminder-templates";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("reminder_templates").select("template_id, title, body");
  if (error) return NextResponse.json({ error: "Standard email wording could not be loaded." }, { status: 500 });
  return NextResponse.json({ templates: (data ?? []).map((template) => ({ id: template.template_id, title: template.title, body: template.body })) });
}

export async function PUT(request: NextRequest) {
  const commissioner = await requireCommissioner(request);
  if (!commissioner) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  let body: { id?: unknown; title?: unknown; message?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Standard email wording was incomplete." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!reminderTemplate(id) || !title || title.length > 80 || !message || message.length > 220) return NextResponse.json({ error: "Use a standard email, a subject up to 80 characters, and a message up to 220 characters." }, { status: 400 });
  const { error } = await supabaseAdmin.from("reminder_templates").upsert({ template_id: id, title, body: message, updated_by_player_id: commissioner.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Standard email wording could not be saved." }, { status: 500 });
  return NextResponse.json({ message: "Standard email wording saved." });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!reminderTemplate(id)) return NextResponse.json({ error: "Choose a standard email to reset." }, { status: 400 });
  const { error } = await supabaseAdmin.from("reminder_templates").delete().eq("template_id", id);
  if (error) return NextResponse.json({ error: "Standard email wording could not be reset." }, { status: 500 });
  return NextResponse.json({ message: "Standard wording restored." });
}
