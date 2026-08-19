import { easternCalendarDayWindow } from "@/lib/email-delivery-plan";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AccountCapacity = {
  id: string;
  service: string;
  metric: string;
  used: number | null;
  limit: number | null;
  unit: string;
  period: string;
  observedAt: string | null;
  detail: string;
  connection: "live" | "awaiting_connection" | "not_reported";
};

const ODDS_API_FREE_MONTHLY_CREDITS = 500;
const BREVO_FREE_DAILY_EMAILS = 300;
const SUPABASE_FREE_DATABASE_MB = 500;

function wholeNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
}

function latestRemaining(details: unknown) {
  if (!details || typeof details !== "object") return null;
  const value = (details as { requestsRemaining?: unknown }).requestsRemaining;
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}

export function usageHealth(used: number | null, limit: number | null) {
  if (used === null || limit === null || limit <= 0) return "unknown" as const;
  const ratio = used / limit;
  if (ratio >= 0.9) return "critical" as const;
  if (ratio >= 0.7) return "watch" as const;
  return "healthy" as const;
}

export async function loadAccountCapacity(now = new Date()): Promise<AccountCapacity[]> {
  const day = easternCalendarDayWindow(now);
  const [databaseResult, emailResult, oddsResult] = await Promise.all([
    supabaseAdmin.rpc("project_database_usage_bytes"),
    supabaseAdmin
      .from("email_reminder_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("delivered_at", day.start)
      .lt("delivered_at", day.end),
    supabaseAdmin
      .from("sync_runs")
      .select("details, completed_at, started_at")
      .eq("provider", "The Odds API")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(8),
  ]);

  const databaseBytes = databaseResult.error ? null : wholeNumber(databaseResult.data);
  const databaseMb = databaseBytes === null ? null : Number((databaseBytes / (1024 * 1024)).toFixed(1));
  const latestOddsRun = (oddsResult.data ?? []).find((run) => latestRemaining(run.details) !== null) ?? null;
  const remainingOddsCredits = latestOddsRun ? latestRemaining(latestOddsRun.details) : null;
  const oddsUsed = remainingOddsCredits === null
    ? null
    : Math.max(0, ODDS_API_FREE_MONTHLY_CREDITS - remainingOddsCredits);

  return [
    {
      id: "odds-api",
      service: "The Odds API",
      metric: "NFL credits",
      used: oddsUsed,
      limit: ODDS_API_FREE_MONTHLY_CREDITS,
      unit: "credits",
      period: "this month",
      observedAt: latestOddsRun?.completed_at ?? latestOddsRun?.started_at ?? null,
      detail: remainingOddsCredits === null
        ? "Waiting for the next normal provider response; this screen never spends a credit to check."
        : `${remainingOddsCredits} credits remain from the latest normal provider response.`,
      connection: remainingOddsCredits === null ? "not_reported" : "live",
    },
    {
      id: "brevo",
      service: "Brevo",
      metric: "PickemJB sends",
      used: emailResult.error ? null : emailResult.count ?? 0,
      limit: BREVO_FREE_DAILY_EMAILS,
      unit: "emails",
      period: "today",
      observedAt: now.toISOString(),
      detail: "Counts accepted PickemJB deliveries. Brevo Free resets this allowance daily.",
      connection: emailResult.error ? "not_reported" : "live",
    },
    {
      id: "supabase",
      service: "Supabase",
      metric: "Database space",
      used: databaseMb,
      limit: SUPABASE_FREE_DATABASE_MB,
      unit: "MB",
      period: "current storage",
      observedAt: databaseMb === null ? null : now.toISOString(),
      detail: databaseMb === null
        ? "Database usage is not available yet."
        : "This is actual database space, not an estimate. Egress and file storage are separate allowances.",
      connection: databaseMb === null ? "not_reported" : "live",
    },
    {
      id: "vercel",
      service: "Vercel",
      metric: "Bandwidth & functions",
      used: null,
      limit: null,
      unit: "usage",
      period: "current billing cycle",
      observedAt: null,
      detail: "Add a read-only Vercel usage token to show the account’s actual current usage.",
      connection: "awaiting_connection",
    },
    {
      id: "github",
      service: "GitHub Actions",
      metric: "Actions minutes & cache",
      used: null,
      limit: null,
      unit: "usage",
      period: "this month",
      observedAt: null,
      detail: "Add a read-only GitHub billing token to show the account’s actual current usage.",
      connection: "awaiting_connection",
    },
    {
      id: "sentry",
      service: "Sentry",
      metric: "Error events",
      used: null,
      limit: null,
      unit: "events",
      period: "this month",
      observedAt: null,
      detail: "Add an org-read Sentry token to show the account’s actual current usage.",
      connection: "awaiting_connection",
    },
    {
      id: "uptimerobot",
      service: "UptimeRobot",
      metric: "Monitors",
      used: null,
      limit: null,
      unit: "monitors",
      period: "current account",
      observedAt: null,
      detail: "Add a read-only UptimeRobot API key to show active monitors against the free allowance.",
      connection: "awaiting_connection",
    },
  ];
}
