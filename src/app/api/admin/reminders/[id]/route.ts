import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { id } = await params;
  const { data, error } = await supabaseAdmin.from("push_reminders").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "scheduled").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Reminder could not be cancelled." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Only a waiting reminder can be cancelled." }, { status: 409 });
  return NextResponse.json({ message: "Reminder cancelled." });
}
