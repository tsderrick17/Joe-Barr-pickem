import { NextRequest, NextResponse } from "next/server";
import { loadAccountCapacity, loadStorageTableUsage } from "@/lib/account-capacity";
import { requireCommissioner } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  try {
    const [accounts, storageTables] = await Promise.all([
      loadAccountCapacity(),
      loadStorageTableUsage().catch(() => []),
    ]);
    return NextResponse.json({ checkedAt: new Date().toISOString(), accounts, storageTables });
  } catch {
    return NextResponse.json({ error: "Account capacity could not be prepared." }, { status: 500 });
  }
}
