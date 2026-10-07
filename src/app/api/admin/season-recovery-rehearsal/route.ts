import { NextRequest, NextResponse } from "next/server";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";
import { runSeasonRecoveryRehearsal } from "@/lib/season-recovery-rehearsal";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ...runSeasonRecoveryRehearsal(),
  });
}
