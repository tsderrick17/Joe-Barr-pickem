import { NextRequest, NextResponse } from "next/server";
import { requireCommissioner } from "@/lib/require-commissioner";
import { runSeasonRecoveryRehearsal } from "@/lib/season-recovery-rehearsal";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ...runSeasonRecoveryRehearsal(),
  });
}
