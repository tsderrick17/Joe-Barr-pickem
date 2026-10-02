import { NextResponse } from "next/server";
import { assessBackupWorkflowRun } from "@/lib/backup-heartbeat.js";
import { HEALTH_CDN_SECONDS, healthProbeCacheControl } from "@/lib/health-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public and opaque: GitHub credentials and workflow details remain server-only. */
export async function GET() {
  const checkedAt = new Date();
  const token = process.env.GITHUB_USAGE_TOKEN;
  try {
    // The repository is public, so the run list is readable without a token.
    // The token only raises GitHub's rate limit; if it is missing, expired, or
    // revoked, fall back to an anonymous read rather than reporting a false
    // backup outage. (Healthy answers are CDN-cached for an hour, so anonymous
    // reads stay far inside GitHub's limit.)
    const runsUrl = "https://api.github.com/repos/tsderrick17/Joe-Barr-pickem/actions/workflows/database-backup.yml/runs?status=completed&per_page=1";
    const read = (withToken: boolean) => fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(withToken && token ? { Authorization: `Bearer ${token}` } : {}),
        "X-GitHub-Api-Version": "2026-03-10",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    let response = await read(Boolean(token));
    if (token && (response.status === 401 || response.status === 403)) response = await read(false);
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);

    const payload = await response.json() as { workflow_runs?: Array<{
      status?: unknown;
      conclusion?: unknown;
      created_at?: unknown;
      run_started_at?: unknown;
      updated_at?: unknown;
    }> };
    const heartbeat = assessBackupWorkflowRun(payload.workflow_runs?.[0], checkedAt);
    if (!heartbeat.healthy) {
      console.error("The encrypted-backup health check is unavailable.", { reason: heartbeat.reason });
    }
    return NextResponse.json(
      { status: heartbeat.healthy ? "ok" : "unavailable", checkedAt: checkedAt.toISOString() },
      { status: heartbeat.healthy ? 200 : 503, headers: { "Cache-Control": healthProbeCacheControl(heartbeat.healthy, HEALTH_CDN_SECONDS.backup) } },
    );
  } catch (error) {
    console.error("The encrypted-backup health check could not be completed.", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { status: "unavailable", checkedAt: checkedAt.toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
