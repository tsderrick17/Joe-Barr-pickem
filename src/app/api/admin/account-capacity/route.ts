import { NextRequest, NextResponse } from "next/server";
import { loadAccountCapacity, loadStorageTableUsage } from "@/lib/account-capacity";
import { commissionerAccess } from "@/lib/require-commissioner";
import { accessDenied } from "@/lib/access-response";

export async function GET(request: NextRequest) {
  const commissionerResult = await commissionerAccess(request);
  if (!commissionerResult.ok) return accessDenied(commissionerResult);

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
