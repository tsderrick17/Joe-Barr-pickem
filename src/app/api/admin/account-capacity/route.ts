import { NextRequest, NextResponse } from "next/server";
import { loadAccountCapacity } from "@/lib/account-capacity";
import { requireCommissioner } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  try {
    return NextResponse.json({ checkedAt: new Date().toISOString(), accounts: await loadAccountCapacity() });
  } catch {
    return NextResponse.json({ error: "Account capacity could not be prepared." }, { status: 500 });
  }
}
