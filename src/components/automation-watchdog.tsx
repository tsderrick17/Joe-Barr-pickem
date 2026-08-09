"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Alert = { id: string; severity: string; title: string; detail: string; detected_at: string; notified_at: string | null; notification_error: string | null };
type Status = { openAlerts: Alert[]; lastRun: { status: string; completed_at: string | null; error_message: string | null } | null };

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
    <section className="border-b-2 border-zinc-900 py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-zinc-600">QUIET WATCHDOG</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">Action-only alerts</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-700">Checks every five minutes. It ignores harmless retries and individual bad email addresses, and sends one commissioner email only when a new actionable incident opens.</p>
        </div>
        <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={busy} onClick={run} type="button">{busy ? "Checking…" : "Run watchdog now"}</button>
      </div>
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
      {status ? <div className={`mt-4 border p-4 ${status.openAlerts.length ? "border-red-700 bg-red-50" : "border-green-800 bg-green-50"}`}>
        <p className="font-bold">{status.openAlerts.length ? `${status.openAlerts.length} incident${status.openAlerts.length === 1 ? "" : "s"} need attention` : "No actionable incidents"}</p>
        {status.openAlerts.map((alert) => <article className="mt-3 border-t border-current pt-3" key={alert.id}><p className="font-bold">{alert.title}</p><p className="mt-1 text-sm">{alert.detail}</p><p className="mt-1 text-xs">Opened {new Date(alert.detected_at).toLocaleString()} · {alert.notified_at ? "commissioner notified" : alert.notification_error ? `email retry pending: ${alert.notification_error}` : "notification pending"}</p></article>)}
        <p className="mt-3 text-xs text-zinc-600">Last check: {status.lastRun?.completed_at ? new Date(status.lastRun.completed_at).toLocaleString() : "not run yet"}</p>
      </div> : null}
    </section>
  );
}
