import { easternCalendarDayWindow } from "@/lib/eastern-calendar-day";
import { summarizeProviderEfficiency } from "@/lib/provider-efficiency.js";
import { monthlyCreditSeries } from "@/lib/provider-chart-data.js";
import { SCORE_POLLING_RETRY_MINUTES } from "@/lib/score-check-backoff";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type ProviderEfficiency = {
  windowDays: number;
  providerCalls: number;
  totalCredits: number;
  scoreCalls: number;
  scoreCredits: number;
  finalizedGames: number;
  productiveScoreCalls: number;
  productiveRate: number | null;
  creditsPerFinal: number | null;
  currentSevenDayCreditsPerFinal: number | null;
  previousSevenDayCreditsPerFinal: number | null;
  trend: "improving" | "worsening" | "steady" | "insufficient";
};

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
  efficiency?: ProviderEfficiency;
  calendarMonth?: {
    monthLabel: string;
    daysInMonth: number;
    daysElapsed: number;
    sundaysInMonth: number;
    providerCalls: number;
    creditsTracked: number;
    scoreCredits: number;
    lineLockCredits: number;
    oddsCredits: number;
    forecastCredits: number;
    forecastTotal: number;
    providerUsed: number | null;
    providerRemaining: number | null;
    providerLimit: number | null;
    reportedAt: string | null;
  };
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

async function providerRunsSince(since: string) {
  const page = (offset: number) => supabaseAdmin
    .from("sync_runs")
    .select("id, job_type, status, details, completed_at, started_at")
    .eq("provider", "The Odds API")
    .in("status", ["success", "failed"])
    .gte("started_at", since)
    .order("started_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + 999);
  const first = await page(0);
  if (first.error) return first;
  const rows = [...(first.data ?? [])];
  for (let offset = 1000; rows.length === offset; offset += 1000) {
    const more = await page(offset);
    if (more.error) return { data: null, error: more.error };
    rows.push(...(more.data ?? []));
  }
  return { data: rows, error: null };
}

function wholeNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
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
  const efficiencyStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const historyStart = new Date(Math.min(Date.parse(efficiencyStart), Date.parse(monthStart))).toISOString();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const [databaseResult, emailResult, oddsResult, monthGamesResult, uptimeRobot, github, sentry] = await Promise.all([
    supabaseAdmin.rpc("project_database_usage_bytes"),
    supabaseAdmin
      .from("email_reminder_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("delivered_at", day.start)
      .lt("delivered_at", day.end),
    providerRunsSince(historyStart),
    supabaseAdmin
      .from("games")
      .select("id, kickoff_at, finalized_at, status")
      .gte("kickoff_at", monthStart)
      .lt("kickoff_at", monthEnd)
      .order("kickoff_at"),
    loadUptimeRobotCapacity(now),
    loadGitHubCapacity(now),
    loadSentryCapacity(now),
  ]);

  const databaseBytes = databaseResult.error ? null : wholeNumber(databaseResult.data);
  const databaseMb = databaseBytes === null ? null : Number((databaseBytes / (1024 * 1024)).toFixed(1));
  const providerEfficiency = summarizeProviderEfficiency(oddsResult.data ?? [], now) as ProviderEfficiency;
  const creditUsage = monthlyCreditSeries(
    oddsResult.data ?? [],
    now,
    monthGamesResult.error ? [] : monthGamesResult.data ?? [],
    [...SCORE_POLLING_RETRY_MINUTES],
  );
  const oddsUsed = creditUsage.reportedUsed;
  const remainingOddsCredits = creditUsage.remaining;
  const sourceCredits = (jobType: string) => creditUsage.days.reduce((sum: number, day: { scores: number; lines: number; other: number }) => sum + (jobType === "scores" ? day.scores : jobType === "lines" ? day.lines : day.other), 0);
  const providerCalendarMonth = {
    monthLabel: creditUsage.monthLabel,
    daysInMonth: creditUsage.calendarDays.length,
    daysElapsed: creditUsage.days.length,
    sundaysInMonth: creditUsage.calendarDays.filter((day: { date: string }) => new Date(day.date).getUTCDay() === 0).length,
    providerCalls: (oddsResult.data ?? []).filter((run) => new Date(run.completed_at ?? run.started_at).getTime() >= new Date(monthStart).getTime()).length,
    creditsTracked: creditUsage.trackedCredits,
    scoreCredits: sourceCredits("scores"),
    lineLockCredits: sourceCredits("lines"),
    oddsCredits: sourceCredits("other"),
    forecastCredits: creditUsage.forecastCredits,
    forecastTotal: creditUsage.forecastTotal,
    providerUsed: creditUsage.reportedUsed,
    providerRemaining: creditUsage.remaining,
    providerLimit: creditUsage.providerLimit,
    reportedAt: creditUsage.reportedAt,
  };

  return [
    {
      id: "odds-api",
      service: "The Odds API",
      metric: "NFL credits",
      used: oddsUsed,
      limit: creditUsage.providerLimit ?? ODDS_API_FREE_MONTHLY_CREDITS,
      unit: "credits",
      period: "this month",
      observedAt: creditUsage.reportedAt,
      detail: remainingOddsCredits === null
        ? "The next successful line or score update will capture this reading automatically; this screen never spends an Odds API credit to check."
        : `${remainingOddsCredits} credits remain from the latest normal provider response. Bowl Pool uses ESPN by default and does not consume this NFL credit pool; an explicitly enabled NCAAF Odds API fallback would use the same monthly allowance.`,
      connection: remainingOddsCredits === null ? "not_reported" : "live",
      efficiency: providerEfficiency,
      calendarMonth: providerCalendarMonth,
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
