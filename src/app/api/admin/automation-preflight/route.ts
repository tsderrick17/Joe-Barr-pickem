import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data, error } = await supabaseAdmin.rpc("automation_preflight");
  if (error) return NextResponse.json({ error: "Automation preflight is unavailable. Run migration 039 in the Supabase SQL Editor." }, { status: 503 });
  const checks = data ?? [];
  return NextResponse.json({ checkedAt: new Date().toISOString(), status: checks.every((check: { passed: boolean }) => check.passed) ? "healthy" : "attention", checks });
}
