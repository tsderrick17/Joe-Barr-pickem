import { respondToCriticalWorkerHealth } from "@/lib/critical-worker-health-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return respondToCriticalWorkerHealth("critical_worker_scores", "scores");
}
