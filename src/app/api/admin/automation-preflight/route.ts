import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireCommissioner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return false;
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const { data: player } = await supabaseAdmin.from("players").select("active, is_commissioner").eq("auth_user_id", user.id).maybeSingle();
  return Boolean(player?.active && player.is_commissioner);
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  const { data, error } = await supabaseAdmin.rpc("automation_preflight");
  if (error) return NextResponse.json({ error: "Automation preflight is unavailable. Run migration 039 in the Supabase SQL Editor." }, { status: 503 });
  const checks = data ?? [];
  return NextResponse.json({ checkedAt: new Date().toISOString(), status: checks.every((check: { passed: boolean }) => check.passed) ? "healthy" : "attention", checks });
}
