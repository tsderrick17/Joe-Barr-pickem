import { checkAutomationHealth } from "@/lib/automation-health";
import { getSeasonBootstrapStatus } from "@/lib/full-schedule-bootstrap";
import { runExternalConfigurationChecks, type LaunchPreflightCheck } from "@/lib/launch-preflight";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { evaluateWatchdogSignals, isConfigurationDriftCheckDue } from "@/lib/watchdog-rules";

type Signal = { key: string; severity: "critical" | "warning"; title: string; detail: string };
type AlertRow = { id: string; signal_key: string; notified_at: string | null; notification_attempted_at: string | null };
type ConfigurationRun = {
  id?: string;
  status: string;
  started_at: string;
  details?: { checks?: LaunchPreflightCheck[] } | null;
};

function isWeeklyStoragePruneDue(now: Date) {
  return now.getUTCDay() === 1 && now.getUTCHours() === 13 && now.getUTCMinutes() < 5;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
async function notifyCommissioners(signal: Signal) {
  const [{ data: commissioners, error }, key, sender] = await Promise.all([
    supabaseAdmin.from("players").select("notification_email").eq("active", true).eq("is_commissioner", true).not("notification_email", "is", null),
    Promise.resolve(process.env.BREVO_API_KEY),
    Promise.resolve(process.env.BREVO_SENDER_EMAIL),
  ]);
  if (error) throw new Error("Commissioner alert recipients could not be loaded.");
  if (!key || !sender) throw new Error("Commissioner alert email is not configured.");
  const recipients = [...new Set((commissioners ?? []).map((player) => player.notification_email).filter(Boolean))] as string[];
  if (!recipients.length) throw new Error("No commissioner notification email is configured.");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "Joe Barr Pick'em Watchdog", email: sender },
      to: recipients.map((email) => ({ email })),
      subject: `[Pick'em action needed] ${signal.title}`,
      htmlContent: `<main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1>${escapeHtml(signal.title)}</h1><p>${escapeHtml(signal.detail)}</p><p><a href="https://pickemjb.vercel.app/admin">Open Commissioner Desk</a></p><p style="color:#57534e;font-size:12px">This alert is sent once per incident. It will not repeat unless the problem resolves and later returns.</p></main>`,
      textContent: `${signal.title}\n\n${signal.detail}\n\nOpen Commissioner Desk: https://pickemjb.vercel.app/admin\n\nThis alert is sent once per incident.`,
      tags: ["pickem-watchdog", signal.key],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Commissioner alert email was rejected (${response.status}).`);
  return recipients.length;
}

async function checkConfigurationDrift(now: Date, latestRun: ConfigurationRun | null) {
  if (!isConfigurationDriftCheckDue(latestRun, now)) {
    return Array.isArray(latestRun?.details?.checks) ? latestRun.details.checks : [];
  }
  const { data: run, error: runError } = await supabaseAdmin.from("sync_runs")
    .insert({ provider: "internal", job_type: "configuration_drift", status: "started", started_at: now.toISOString() })
    .select("id").single();
  if (runError || !run) throw new Error("The configuration-drift check could not be recorded.");
  try {
    const checks = await runExternalConfigurationChecks();
    const healthy = checks.every((item) => item.passed);
    const { error: completionError } = await supabaseAdmin.from("sync_runs").update({
      status: healthy ? "success" : "failed",
      completed_at: new Date().toISOString(),
      details: { checks, status: healthy ? "healthy" : "attention" },
      error_message: healthy ? null : "One or more external configuration checks need attention.",
    }).eq("id", run.id);
    if (completionError) throw new Error("The configuration-drift receipt could not be completed.");
    return checks;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration drift could not be checked.";
    const checks: LaunchPreflightCheck[] = [{
      check_id: "configuration-drift-run",
      label: "Daily configuration drift check",
      passed: false,
      detail: message,
      group: "providers",
    }];
    const { error: failureError } = await supabaseAdmin.from("sync_runs").update({
      status: "failed", completed_at: new Date().toISOString(), error_message: message, details: { checks, status: "attention" },
    }).eq("id", run.id);
    if (failureError) throw new Error(`${message} The failed configuration-drift receipt could not be saved.`);
    return checks;
  }
}

export async function getWatchdogStatus() {
  const [{ data: alerts, error }, { data: lastRun, error: runError }] = await Promise.all([
    supabaseAdmin.from("automation_alerts").select("id, signal_key, severity, title, detail, detected_at, last_seen_at, notified_at, resolved_at, notification_error")
      .order("detected_at", { ascending: false }).limit(20),
    supabaseAdmin.from("sync_runs").select("status, started_at, completed_at, error_message, details")
      .eq("job_type", "watchdog").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error || runError) throw new Error("Watchdog status could not be loaded.");
  return { openAlerts: (alerts ?? []).filter((alert) => !alert.resolved_at), recentAlerts: alerts ?? [], lastRun };
}

export async function runAutomationWatchdog(now = new Date()) {
  const { data: run, error: runError } = await supabaseAdmin.from("sync_runs")
    .insert({ provider: "internal", job_type: "watchdog", status: "started" }).select("id").single();
  if (runError || !run) throw new Error("The watchdog run could not be recorded.");
  try {
    const [health, bootstrap, preflight, storagePrune, configurationRun] = await Promise.all([
      checkAutomationHealth(now), getSeasonBootstrapStatus(now), supabaseAdmin.rpc("automation_preflight"),
      isWeeklyStoragePruneDue(now)
        ? supabaseAdmin.rpc("prune_operational_storage", { reference_time: now.toISOString() })
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin.from("sync_runs").select("status, started_at, details")
        .eq("job_type", "configuration_drift").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (preflight.error) throw new Error("Automation preflight could not be evaluated.");
    if (storagePrune.error) throw new Error("The weekly operational storage cleanup could not be completed.");
    if (configurationRun.error) throw new Error("The latest configuration-drift check could not be loaded.");
    const configurationChecks = await checkConfigurationDrift(now, configurationRun.data as ConfigurationRun | null);
    const signals = evaluateWatchdogSignals({
      health,
      bootstrap,
      preflightChecks: [...(preflight.data ?? []), ...configurationChecks],
      now,
    }) as Signal[];
    const { data: openAlerts, error: alertsError } = await supabaseAdmin.from("automation_alerts")
      .select("id, signal_key, notified_at, notification_attempted_at").is("resolved_at", null);
    if (alertsError) throw new Error("Open watchdog incidents could not be loaded.");
    const activeKeys = new Set(signals.map((signal) => signal.key));
    const resolvedIds = (openAlerts ?? []).filter((alert) => !activeKeys.has(alert.signal_key)).map((alert) => alert.id);
    if (resolvedIds.length) await supabaseAdmin.from("automation_alerts").update({ resolved_at: now.toISOString(), last_seen_at: now.toISOString() }).in("id", resolvedIds);
    const openByKey = new Map((openAlerts ?? []).map((alert) => [alert.signal_key, alert as AlertRow]));
    let opened = 0;
    let notified = 0;
    for (const signal of signals) {
      let alert = openByKey.get(signal.key);
      if (!alert) {
        const { data: inserted, error } = await supabaseAdmin.from("automation_alerts").insert({
          signal_key: signal.key, severity: signal.severity, title: signal.title, detail: signal.detail,
          detected_at: now.toISOString(), last_seen_at: now.toISOString(), details: signal,
        }).select("id, signal_key, notified_at, notification_attempted_at").single();
        if (error || !inserted) throw new Error("A watchdog incident could not be recorded.");
        alert = inserted as AlertRow;
        opened += 1;
      } else {
        await supabaseAdmin.from("automation_alerts").update({ last_seen_at: now.toISOString(), severity: signal.severity, title: signal.title, detail: signal.detail, details: signal }).eq("id", alert.id);
      }
      const retryDue = !alert.notification_attempted_at || now.getTime() - new Date(alert.notification_attempted_at).getTime() >= 30 * 60 * 1000;
      if (!alert.notified_at && retryDue) {
        await supabaseAdmin.from("automation_alerts").update({ notification_attempted_at: now.toISOString() }).eq("id", alert.id);
        try {
          const recipients = await notifyCommissioners(signal);
          await supabaseAdmin.from("automation_alerts").update({ notified_at: now.toISOString(), notification_recipients: recipients, notification_error: null }).eq("id", alert.id);
          notified += 1;
        } catch (error) {
          await supabaseAdmin.from("automation_alerts").update({ notification_error: error instanceof Error ? error.message : "Alert delivery failed." }).eq("id", alert.id);
        }
      }
    }
    const details = {
      signals: signals.length,
      opened,
      resolved: resolvedIds.length,
      notified,
      configurationChecks: configurationChecks.length,
      storagePruned: storagePrune.data ?? undefined,
    };
    await supabaseAdmin.from("sync_runs").update({ status: "success", completed_at: new Date().toISOString(), details }).eq("id", run.id);
    return details;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The watchdog failed.";
    await supabaseAdmin.from("sync_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message }).eq("id", run.id);
    throw error;
  }
}
