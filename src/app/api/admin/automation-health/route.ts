import { NextRequest, NextResponse } from "next/server";
import { checkAutomationHealth } from "@/lib/automation-health";
import { requireCommissioner } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });

  try {
    return NextResponse.json(await checkAutomationHealth());
  } catch {
    return NextResponse.json(
      { error: "Automation health could not be prepared." },
      { status: 500 },
    );
  }
}
