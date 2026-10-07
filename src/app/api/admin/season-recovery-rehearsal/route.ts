import { NextRequest, NextResponse } from "next/server";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";
import { runSeasonRecoveryRehearsal } from "@/lib/season-recovery-rehearsal";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ...runSeasonRecoveryRehearsal(),
  });
}
