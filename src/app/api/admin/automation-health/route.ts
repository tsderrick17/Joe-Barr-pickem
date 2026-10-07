import { NextRequest, NextResponse } from "next/server";
import { checkAutomationHealth } from "@/lib/automation-health";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

  try {
    return NextResponse.json(await checkAutomationHealth());
  } catch {
    return NextResponse.json(
      { error: "Automation health could not be prepared." },
      { status: 500 },
    );
  }
}
