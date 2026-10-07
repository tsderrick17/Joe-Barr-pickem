import { NextRequest, NextResponse } from "next/server";
import { loadAccountCapacity, loadStorageTableUsage } from "@/lib/account-capacity";
import { requireCommissionerAccess, commissionerAccessFailure } from "@/lib/require-commissioner";

export async function GET(request: NextRequest) {
  const access = await requireCommissionerAccess(request);
  if (!access.ok) return commissionerAccessFailure(access);

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
