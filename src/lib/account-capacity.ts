import { easternCalendarDayWindow } from "@/lib/eastern-calendar-day";
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

export type StorageTableUsage = {
  relation_name: string;
  total_bytes: number;
  table_bytes: number;
  index_bytes: number;
  estimated_rows: number;
};

const ODDS_API_FREE_MONTHLY_CREDITS = 500;
const BREVO_FREE_DAILY_EMAILS = 300;
const SUPABASE_FREE_DATABASE_MB = 500;
const GITHUB_FREE_ACTIONS_MINUTES = 2_000;
let uptimeRobotCache: { expiresAt: number; account: AccountCapacity } | null = null;
let githubUsageCache: { expiresAt: number; account: AccountCapacity } | null = null;
let sentryUsageCache: { expiresAt: number; account: AccountCapacity } | null = null;

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

async function loadUptimeRobotCapacity(now: Date): Promise<AccountCapacity> {
  const key = process.env.UPTIMEROBOT_READ_ONLY_API_KEY;
  if (!key) {
    return {
      id: "uptimerobot", service: "UptimeRobot", metric: "Monitors", used: null, limit: null,
      unit: "monitors", period: "current account", observedAt: null,
      detail: "Add a read-only UptimeRobot API key to show active monitors against the free allowance.",
      connection: "awaiting_connection",
    };
  }

  if (uptimeRobotCache && uptimeRobotCache.expiresAt > now.getTime()) return uptimeRobotCache.account;

  try {
    const response = await fetch("https://api.uptimerobot.com/v2/getAccountDetails", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: key.trim(), format: "json" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`UptimeRobot returned ${response.status}.`);
    const payload = await response.json() as { stat?: string; account?: Record<string, unknown> };
    const account = payload.account ?? {};
    const used = ["up_monitors", "down_monitors", "paused_monitors"]
      .map((field) => wholeNumber(account[field]) ?? 0)
      .reduce((total, count) => total + count, 0);
    const limit = wholeNumber(account.monitor_limit);
    if (payload.stat !== "ok" || limit === null) {
      // Some read-only keys can list monitors but cannot read the optional
      // account summary. Fall back without granting the app any write scope.
      const monitorsResponse = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ api_key: key.trim(), format: "json", limit: "50" }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!monitorsResponse.ok) throw new Error(`UptimeRobot returned ${monitorsResponse.status}.`);
      const monitorsPayload = await monitorsResponse.json() as { stat?: string; monitors?: unknown[]; pagination?: { total?: unknown } };
      if (monitorsPayload.stat !== "ok" || !Array.isArray(monitorsPayload.monitors)) throw new Error("UptimeRobot did not return monitors.");
      const monitorCount = wholeNumber(monitorsPayload.pagination?.total) ?? monitorsPayload.monitors.length;
      const result: AccountCapacity = {
        id: "uptimerobot", service: "UptimeRobot", metric: "Monitors", used: monitorCount, limit: 50,
        unit: "monitors", period: "current account", observedAt: now.toISOString(),
        detail: `${monitorCount} of 50 free monitor slots are in use. This read-only fallback is cached for five minutes.`,
        connection: "live",
      };
      uptimeRobotCache = { expiresAt: now.getTime() + 5 * 60 * 1000, account: result };
      return result;
    }
    const result: AccountCapacity = {
      id: "uptimerobot", service: "UptimeRobot", metric: "Monitors", used, limit,
      unit: "monitors", period: "current account", observedAt: now.toISOString(),
      detail: `${used} of ${limit} monitor slots are in use. This read-only check is cached for five minutes.`,
      connection: "live",
    };
    uptimeRobotCache = { expiresAt: now.getTime() + 5 * 60 * 1000, account: result };
    return result;
  } catch {
    return {
      id: "uptimerobot", service: "UptimeRobot", metric: "Monitors", used: null, limit: null,
      unit: "monitors", period: "current account", observedAt: null,
      detail: "UptimeRobot did not return a usable account summary. The monitor itself remains unchanged.",
      connection: "not_reported",
    };
  }
}

async function loadGitHubCapacity(now: Date): Promise<AccountCapacity> {
  const token = process.env.GITHUB_USAGE_TOKEN;
  if (!token) {
    return {
      id: "github", service: "GitHub Actions", metric: "Actions minutes", used: null, limit: null,
      unit: "minutes", period: "this month", observedAt: null,
      detail: "Add a GitHub Plan-read token to show the account’s actual current usage.",
      connection: "awaiting_connection",
    };
  }

  if (githubUsageCache && githubUsageCache.expiresAt > now.getTime()) return githubUsageCache.account;

  try {
    const response = await fetch("https://api.github.com/users/tsderrick17/settings/billing/usage/summary?product=actions", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
    const payload = await response.json() as { usageItems?: Array<{ product?: unknown; unitType?: unknown; grossQuantity?: unknown }> };
    const used = (payload.usageItems ?? [])
      .filter((item) => String(item.product).toLowerCase() === "actions" && String(item.unitType).toLowerCase() === "minutes")
      .reduce((total, item) => total + (wholeNumber(item.grossQuantity) ?? 0), 0);
    const result: AccountCapacity = {
      id: "github", service: "GitHub Actions", metric: "Actions minutes", used, limit: GITHUB_FREE_ACTIONS_MINUTES,
      unit: "minutes", period: "this month", observedAt: now.toISOString(),
      detail: "GitHub Free includes 2,000 private-repository Actions minutes each month. Standard runners in public repositories are free.",
      connection: "live",
    };
    githubUsageCache = { expiresAt: now.getTime() + 5 * 60 * 1000, account: result };
    return result;
  } catch {
    return {
      id: "github", service: "GitHub Actions", metric: "Actions minutes", used: null, limit: null,
      unit: "minutes", period: "this month", observedAt: null,
      detail: "GitHub did not return a usable Actions usage summary. Repository access remains unchanged.",
      connection: "not_reported",
    };
  }
}

async function loadSentryCapacity(now: Date): Promise<AccountCapacity> {
  const token = process.env.SENTRY_USAGE_TOKEN;
  if (!token) {
    return {
      id: "sentry", service: "Sentry", metric: "Error events", used: null, limit: null,
      unit: "events", period: "this month", observedAt: null,
      detail: "Add an org-read Sentry token to show actual error-event usage.",
      connection: "awaiting_connection",
    };
  }

  if (sentryUsageCache && sentryUsageCache.expiresAt > now.getTime()) return sentryUsageCache.account;

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const organizationsResponse = await fetch("https://sentry.io/api/0/organizations/", { headers, signal: AbortSignal.timeout(10_000) });
    if (!organizationsResponse.ok) throw new Error(`Sentry returned ${organizationsResponse.status}.`);
    const organizations = await organizationsResponse.json() as Array<{ slug?: unknown }>;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const end = now.toISOString();
    const responses = await Promise.all((organizations ?? []).map(async (organization) => {
      const slug = typeof organization.slug === "string" ? organization.slug : null;
      if (!slug) return null;
      const query = new URLSearchParams({ field: "sum(times_seen)", category: "error", outcome: "accepted", start, end });
      query.append("groupBy", "outcome");
      const response = await fetch(`https://sentry.io/api/0/organizations/${encodeURIComponent(slug)}/stats_v2/?${query}`, { headers, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Sentry statistics returned ${response.status}.`);
      return response.json() as Promise<{ groups?: Array<{ totals?: Record<string, unknown> }> }>;
    }));
    const used = responses.filter(Boolean).reduce((total, response) => total + (response?.groups ?? []).reduce(
      (groupTotal, group) => groupTotal + (wholeNumber(group.totals?.["sum(times_seen)"]) ?? 0),
      0,
    ), 0);
    const limit = wholeNumber(process.env.SENTRY_ERROR_EVENT_LIMIT);
    const result: AccountCapacity = {
      id: "sentry", service: "Sentry", metric: "Error events", used, limit,
      unit: "events", period: "this month", observedAt: now.toISOString(),
      detail: limit === null
        ? "Actual accepted error events this month. Sentry does not expose the plan quota through this read-only API."
        : `Actual accepted error events this month against your configured Sentry plan limit of ${limit.toLocaleString()}.`,
      connection: "live",
    };
    sentryUsageCache = { expiresAt: now.getTime() + 5 * 60 * 1000, account: result };
    return result;
  } catch (error) {
    const reason = error instanceof Error && /Sentry (returned|statistics returned) \d{3}/.test(error.message)
      ? error.message
      : "Sentry did not provide a readable usage response.";
    return {
      id: "sentry", service: "Sentry", metric: "Error events", used: null, limit: null,
      unit: "events", period: "this month", observedAt: null,
      detail: `${reason} No Sentry settings were changed.`,
      connection: "not_reported",
    };
  }
}

export async function loadAccountCapacity(now = new Date()): Promise<AccountCapacity[]> {
  const day = easternCalendarDayWindow(now);
  const [databaseResult, emailResult, oddsResult, uptimeRobot, github, sentry] = await Promise.all([
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
    loadUptimeRobotCapacity(now),
    loadGitHubCapacity(now),
    loadSentryCapacity(now),
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
        ? "The next successful line or score update will capture this reading automatically; this screen never spends an Odds API credit to check."
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
      detail: "Vercel does not provide Hobby-plan billing usage to this read-only app connection. Check Usage in the Vercel dashboard.",
      connection: "not_reported",
    },
    github,
    sentry,
    uptimeRobot,
  ];
}

export async function loadStorageTableUsage(): Promise<StorageTableUsage[]> {
  const { data, error } = await supabaseAdmin.rpc("storage_table_usage");
  if (error) throw new Error("Database storage details could not be loaded.");
  return (data ?? []).map((row: {
    relation_name: unknown;
    total_bytes: unknown;
    table_bytes: unknown;
    index_bytes: unknown;
    estimated_rows: unknown;
  }) => ({
    relation_name: String(row.relation_name),
    total_bytes: wholeNumber(row.total_bytes) ?? 0,
    table_bytes: wholeNumber(row.table_bytes) ?? 0,
    index_bytes: wholeNumber(row.index_bytes) ?? 0,
    estimated_rows: wholeNumber(row.estimated_rows) ?? 0,
  }));
}
