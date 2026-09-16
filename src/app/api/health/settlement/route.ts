import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The score worker begins at 2h50m after kickoff. Four hours gives it a
// bounded cushion without hiding a genuinely stalled settlement.
const SETTLEMENT_GRACE_MS = 4 * 60 * 60 * 1000;
const SETTLED_STATUSES = ["final", "postponed", "cancelled", "no_contest"];

export async function GET() {
  const checkedAt = new Date();
  try {
    const cutoff = new Date(checkedAt.getTime() - SETTLEMENT_GRACE_MS).toISOString();
    const { data: games, error } = await supabaseAdmin.from("games").select("id, kickoff_at, status").lte("kickoff_at", cutoff).not("status", "in", `(${SETTLED_STATUSES.join(",")})`);
    if (error) throw error;
    if ((games ?? []).length > 0) return NextResponse.json({ status: "unavailable", checkedAt: checkedAt.toISOString() }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
    return NextResponse.json({ status: "ok", checkedAt: checkedAt.toISOString() }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Settlement freshness check could not be completed.", { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ status: "unavailable", checkedAt: checkedAt.toISOString() }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
