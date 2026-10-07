import { NextRequest, NextResponse } from "next/server";
import { runLaunchPreflight } from "@/lib/launch-preflight";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);
  try {
    return NextResponse.json(await runLaunchPreflight());
  } catch {
    return NextResponse.json({ error: "Launch preflight could not complete safely." }, { status: 503 });
  }
}
