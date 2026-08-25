import { supabaseAdmin } from "@/lib/supabase-admin";
import { assessAutomationHeartbeat } from "@/lib/automation-heartbeat";

export type LaunchPreflightCheck = {
  check_id: string;
  label: string;
  passed: boolean;
  detail: string;
  group: "schedules" | "authorization" | "providers" | "alerts";
};

type BrevoSender = { active?: boolean; email?: string; name?: string };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function check(
  check_id: string,
  label: string,
  passed: boolean,
  detail: string,
  group: LaunchPreflightCheck["group"],
): LaunchPreflightCheck {
  return { check_id, label, passed, detail, group };
}

async function checkOddsProvider(): Promise<LaunchPreflightCheck> {
  const key = process.env.ODDS_API_KEY;
  if (!key) return check("odds-provider", "NFL odds provider", false, "ODDS_API_KEY is missing from the deployment.", "providers");
  try {
    // The provider documents /sports as a zero-credit authentication check.
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/?${new URLSearchParams({ apiKey: key, all: "true" })}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload: unknown = await response.json().catch(() => null);
    const nflAvailable = Array.isArray(payload) && payload.some(
      (sport) => typeof sport === "object" && sport !== null && (sport as { key?: string }).key === "americanfootball_nfl",
    );
    return check(
      "odds-provider",
      "NFL odds provider",
      response.ok && nflAvailable,
      response.ok && nflAvailable
        ? "Credentials are accepted and the NFL feed is available; this check used zero provider credits."
        : `Provider authentication or NFL availability failed (HTTP ${response.status}).`,
      "providers",
    );
  } catch {
    return check("odds-provider", "NFL odds provider", false, "The zero-credit provider check could not be reached.", "providers");
  }
}

async function checkBrevo(): Promise<LaunchPreflightCheck[]> {
  const key = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase() ?? "";
  if (!key) {
    return [
      check("brevo-api", "Brevo delivery account", false, "BREVO_API_KEY is missing from the deployment.", "providers"),
      check("brevo-sender", "PickemJB sender", false, "Sender verification cannot run until Brevo is configured.", "providers"),
    ];
  }
  try {
    const response = await fetch("https://api.brevo.com/v3/senders", {
      headers: { "api-key": key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as { senders?: BrevoSender[] };
    const senders = Array.isArray(payload.senders) ? payload.senders : [];
    const configuredSender = senders.find((sender) => sender.email?.trim().toLowerCase() === senderEmail);
    return [
      check(
        "brevo-api",
        "Brevo delivery account",
        response.ok,
        response.ok ? "The Brevo API key is accepted and sender settings are readable." : `Brevo rejected the launch check (HTTP ${response.status}).`,
        "providers",
      ),
      check(
        "brevo-sender",
        "PickemJB sender",
        response.ok && emailPattern.test(senderEmail) && configuredSender?.active === true,
        !emailPattern.test(senderEmail)
          ? "BREVO_SENDER_EMAIL is missing or invalid."
          : configuredSender?.active === true
            ? "The configured PickemJB sender address is active in Brevo."
            : "The configured sender address is not an active Brevo sender.",
        "providers",
      ),
    ];
  } catch {
    return [
      check("brevo-api", "Brevo delivery account", false, "Brevo could not be reached for the launch check.", "providers"),
      check("brevo-sender", "PickemJB sender", false, "Sender status could not be verified.", "providers"),
    ];
  }
}

async function checkCommissionerAlerts(): Promise<LaunchPreflightCheck> {
  const { data, error } = await supabaseAdmin
    .from("players")
    .select("notification_email")
    .eq("active", true)
    .eq("is_commissioner", true)
    .not("notification_email", "is", null);
  if (error) return check("commissioner-alert-address", "Commissioner alert address", false, "Commissioner alert recipients could not be read.", "alerts");
  const addresses = [...new Set((data ?? []).map((player) => player.notification_email?.trim().toLowerCase()).filter((email): email is string => Boolean(email && emailPattern.test(email))))];
  return check(
    "commissioner-alert-address",
    "Commissioner alert address",
    addresses.length > 0,
    addresses.length > 0
      ? `${addresses.length} active Commissioner alert address${addresses.length === 1 ? " is" : "es are"} ready.`
      : "No active Commissioner has a valid notification email for watchdog alerts.",
    "alerts",
  );
}

async function checkSupabaseAuthorization(): Promise<LaunchPreflightCheck> {
  const { error } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .limit(1);
  return check(
    "supabase-server-authorization",
    "Supabase server authorization",
    !error,
    !error
      ? "The production server credential is accepted by the Supabase Data API."
      : "Supabase rejected the production server credential; automation and privileged reads cannot run.",
    "authorization",
  );
}

async function checkCronAuthorization(): Promise<LaunchPreflightCheck> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return check("cron-authorization", "Cron authorization", false, "CRON_SECRET is missing from the deployment.", "authorization");
  const { data, error } = await supabaseAdmin.rpc("automation_cron_secret_matches", { candidate_secret: secret });
  return check(
    "cron-authorization",
    "Cron authorization",
    !error && data === true,
    !error && data === true
      ? "The deployment secret matches Supabase Vault; scheduled requests will authenticate."
      : "The deployment CRON_SECRET does not match the Supabase Vault cron_secret.",
    "authorization",
  );
}

async function checkWatchdogHeartbeat(): Promise<LaunchPreflightCheck> {
  const { data, error } = await supabaseAdmin
    .from("sync_runs")
    .select("status,started_at,completed_at")
    .eq("job_type", "watchdog")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const heartbeat = error ? { healthy: false } : assessAutomationHeartbeat(data);
  return check(
    "watchdog-heartbeat",
    "Internal automation heartbeat",
    heartbeat.healthy,
    heartbeat.healthy
      ? "The five-minute watchdog has completed successfully within the last 12 minutes."
      : "The watchdog has not completed successfully within the last 12 minutes.",
    "schedules",
  );
}

export async function runLaunchPreflight() {
  const [scheduleResult, watchdogHeartbeat, externalChecks] = await Promise.all([
    supabaseAdmin.rpc("automation_preflight"),
    checkWatchdogHeartbeat(),
    runExternalConfigurationChecks(),
  ]);
  const scheduleChecks: LaunchPreflightCheck[] = scheduleResult.error
    ? [check("schedule-preflight", "Supabase automation schedules", false, "The schedule preflight function is unavailable.", "schedules")]
    : (scheduleResult.data ?? []).map((item: { check_id: string; label: string; passed: boolean; detail: string }) => ({ ...item, group: item.check_id === "cron-secret" ? "authorization" as const : "schedules" as const }));
  const checks = [...scheduleChecks, watchdogHeartbeat, ...externalChecks];
  return {
    checkedAt: new Date().toISOString(),
    status: checks.every((item) => item.passed) ? "healthy" as const : "attention" as const,
    checks,
  };
}

export async function runExternalConfigurationChecks() {
  const [supabaseAuthorization, cronAuthorization, oddsProvider, brevoChecks, commissionerAlerts] = await Promise.all([
    checkSupabaseAuthorization(),
    checkCronAuthorization(),
    checkOddsProvider(),
    checkBrevo(),
    checkCommissionerAlerts(),
  ]);
  return [supabaseAuthorization, cronAuthorization, oddsProvider, ...brevoChecks, commissionerAlerts];
}
