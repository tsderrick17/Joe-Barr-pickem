"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Alert = { id: string; severity: string; title: string; detail: string; detected_at: string; notified_at: string | null; notification_error: string | null };
type Warning = { id: string; job: string; message: string; details: Record<string, unknown>; occurrences: number; last_seen_at: string };
type Status = { openAlerts: Alert[]; warnings?: Warning[]; lastRun: { status: string; completed_at: string | null; error_message: string | null } | null };

const JOB_NAMES: Record<string, string> = {
  line_locks: "Line locking", scores: "Score sync", bowl_scores: "Bowl Pool sync", reminders: "Reminders", reminder_schedule: "Reminder schedule",
  season_bootstrap: "Season setup", watchdog: "Watchdog", schedule_refresh: "Schedule refresh", pool_integrity: "Health checks",
};
const detailText = (details: Record<string, unknown>) => Object.entries(details).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ");

export default function AutomationWatchdog() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetchWithSession("/api/admin/watchdog");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Watchdog status could not be loaded.");
    setStatus(data);
  }
  useEffect(() => {
    let cancelled = false;
    async function loadInitialStatus() {
      try {
        const response = await fetchWithSession("/api/admin/watchdog");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Watchdog status could not be loaded.");
        if (!cancelled) setStatus(data);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Watchdog status could not be loaded.");
      }
    }
    void loadInitialStatus();
    return () => { cancelled = true; };
  }, []);
  async function run() {
    setBusy(true); setError("");
    try {
      const response = await fetchWithSession("/api/admin/watchdog", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Watchdog could not run.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Watchdog could not run."); }
    finally { setBusy(false); }
  }
  return (
    <section className="commissioner-tool">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-(color:--themed-text-28)">QUIET WATCHDOG</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">Action-only alerts</h2>
          <p className="mt-1 max-w-2xl text-sm text-(color:--themed-text-29)">Checks every five minutes. It ignores harmless retries and individual bad email addresses, and sends one commissioner email only when a new actionable incident opens.</p>
        </div>
        <button className="desk-button px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={busy} onClick={run} type="button">{busy ? "Checking…" : "Run watchdog now"}</button>
      </div>
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
      {status ? <div className={`mt-4 border p-4 ${status.openAlerts.length ? "border-(color:--themed-border-24) bg-(color:--themed-bg-24)" : "border-(color:--themed-border-21) bg-(color:--themed-bg-23)"}`}>
        <p className="font-bold">{status.openAlerts.length ? `${status.openAlerts.length} incident${status.openAlerts.length === 1 ? "" : "s"} need attention` : "No actionable incidents"}</p>
        {status.openAlerts.map((alert) => <article className="mt-3 border-t border-current pt-3" key={alert.id}><p className="font-bold">{alert.title}</p><p className="mt-1 text-sm">{alert.detail}</p><p className="mt-1 text-xs">Opened {new Date(alert.detected_at).toLocaleString()} · {alert.notified_at ? "commissioner notified" : alert.notification_error ? `email retry pending: ${alert.notification_error}` : "notification pending"}</p></article>)}
        <p className="mt-3 text-xs text-(color:--themed-text-28)">Last check: {status.lastRun?.completed_at ? new Date(status.lastRun.completed_at).toLocaleString() : "not run yet"}</p>
      </div> : null}
      {status?.warnings ? <div className="mt-4 border border-(color:--themed-border-21) bg-(color:--themed-bg-23) p-4">
        <p className="font-bold">{status.warnings.length ? "Recent warnings" : "No warnings this week"}</p>
        <p className="mt-1 text-xs text-(color:--themed-text-28)">Things the automation worked around without stopping. They are not incidents and send no email.</p>
        {status.warnings.map((warning) => <article className="mt-3 border-t border-current pt-3" key={warning.id}>
          <p className="font-bold">{warning.message}</p>
          {Object.keys(warning.details).length ? <p className="mt-1 text-sm">{detailText(warning.details)}</p> : null}
          <p className="mt-1 text-xs">{JOB_NAMES[warning.job] ?? warning.job} · seen {warning.occurrences} {warning.occurrences === 1 ? "time" : "times"} · last {new Date(warning.last_seen_at).toLocaleString()}</p>
        </article>)}
      </div> : null}
    </section>
  );
}
