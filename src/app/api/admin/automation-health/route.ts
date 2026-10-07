import { NextRequest, NextResponse } from "next/server";
import { checkAutomationHealth } from "@/lib/automation-health";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

  try {
    return NextResponse.json(await checkAutomationHealth());
  } catch {
    return NextResponse.json(
      { error: "Automation health could not be prepared." },
      { status: 500 },
    );
  }
}
