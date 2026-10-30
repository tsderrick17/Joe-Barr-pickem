import { HEALTH_CDN_SECONDS } from "@/lib/health-cache";
import { checkWeeklyRecap } from "@/lib/pool-integrity-probes";
import { poolIntegrityResponse } from "@/lib/pool-integrity-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return poolIntegrityResponse("Pool integrity check (recap)", HEALTH_CDN_SECONDS.recap, checkWeeklyRecap);
}
