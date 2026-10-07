import { NextRequest, NextResponse } from "next/server";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
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
