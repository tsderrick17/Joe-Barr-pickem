import { NextRequest, NextResponse } from "next/server";
import { runLaunchPreflight } from "@/lib/launch-preflight";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);
  try {
    return NextResponse.json(await runLaunchPreflight());
  } catch {
    return NextResponse.json({ error: "Launch preflight could not complete safely." }, { status: 503 });
  }
}
