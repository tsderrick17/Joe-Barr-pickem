import { NextRequest, NextResponse } from "next/server";
import { runLaunchPreflight } from "@/lib/launch-preflight";
import { requireCommissioner } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  try {
    return NextResponse.json(await runLaunchPreflight());
  } catch {
    return NextResponse.json({ error: "Launch preflight could not complete safely." }, { status: 503 });
  }
}
