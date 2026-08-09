"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Run = {
  completed_at: string | null;
  started_at: string;
  status: "started" | "success" | "failed";
};

type Health = {
  status: "healthy" | "attention";
  problems: string[];
  latestSuccessfulLocks: Run | null;
  latestSuccessfulScores: Run | null;
  scoreCandidates: number;
  scoreProviderFailureStreak: number;
  scoreProviderRetryAt: string | null;
  scheduleProviderCircuit: {
    consecutive_failures: number;
    next_retry_at: string;
    last_error: string;
  } | null;
  scheduleProviderCooldownActive: boolean;
  reminderHealth: {
    overdueScheduled: number;
    staleSending: number;
    recentEmailFailures: number;
  };
  providerAllowance: number | null;
  retention: { candidates: number; cutoff: string };
};

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function fetchHealth() {
  const response = await fetchWithSession("/api/admin/automation-health");
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error ?? "Automation health could not be loaded.");
  return data as Health;
}

function localTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "not recorded";
}

function StatusCard({
  label,
  value,
  detail,
  attention = false,
}: {
  label: string;
  value: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <article className={`border p-3 ${attention ? "border-amber-700 bg-amber-50" : "border-zinc-300 bg-white"}`}>
      <p className="text-[11px] font-black tracking-[0.14em] text-zinc-600">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
    </article>
  );
}

export default function AutomationHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"scores" | "schedule" | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialHealth() {
      try {
        const result = await fetchHealth();
        if (!cancelled) setHealth(result);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Automation health could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialHealth();
    return () => { cancelled = true; };
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setHealth(await fetchHealth());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Automation health could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function runEmergency(kind: "scores" | "schedule") {
    const explanation = kind === "scores"
      ? "Run a final-score check now? This intentionally bypasses the automatic score cooldown, but still preserves provider quota and overlap safeguards."
      : "Run a schedule and line-history refresh now? This intentionally bypasses the automatic schedule cooldown and may consume one provider request.";
    if (!window.confirm(explanation)) return;

    setAction(kind);
    setError("");
    setMessage("");
    try {
      const response = await fetchWithSession(
        kind === "scores" ? "/api/admin/sync-scores" : "/api/admin/import-games",
        { method: "POST" },
      );
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? "The emergency run could not be completed.");
      setMessage(data.message ?? "The emergency run completed safely.");
      setHealth(await fetchHealth());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The emergency run could not be completed.");
    } finally {
      setAction(null);
    }
  }

  const scheduleCooling = health?.scheduleProviderCooldownActive === true;

  return (
    <section className="border-b-2 border-zinc-900 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-zinc-600">AUTOMATION STATUS</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">The pool at a glance</h2>
          <p className="mt-2 max-w-2xl text-zinc-700">Provider usage, cooldowns, and the last successful runs. Routine recovery is automatic; the override buttons are for a verified emergency.</p>
        </div>
        <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading || action !== null} onClick={refresh} type="button">
          {loading ? "Checking..." : "Refresh status"}
        </button>
      </div>

      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}

      {health ? <>
        <div className={`mt-5 border p-4 ${health.status === "healthy" ? "border-green-800 bg-green-50 text-green-950" : "border-red-700 bg-red-50 text-red-950"}`}>
          <p className="font-bold">{health.status === "healthy" ? "Automation is healthy" : "Automation needs attention"}</p>
          {health.problems.length ? <ul className="mt-2 list-disc pl-5 text-sm">{health.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul> : <p className="mt-1 text-sm">No overdue lines, stale scoring checks, provider incidents, or stuck reminders are detected.</p>}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <StatusCard label="OFFICIAL LINES" value="Last successful lock" detail={localTime(health.latestSuccessfulLocks?.completed_at ?? health.latestSuccessfulLocks?.started_at)} />
          <StatusCard
            attention={health.scoreProviderFailureStreak > 0}
            label="FINAL SCORES"
            value={health.scoreProviderFailureStreak > 0 ? `${health.scoreProviderFailureStreak} failed attempt${health.scoreProviderFailureStreak === 1 ? "" : "s"}` : "Automatic checks ready"}
            detail={health.scoreProviderFailureStreak > 0 ? `Next retry ${localTime(health.scoreProviderRetryAt)}` : `Last success ${localTime(health.latestSuccessfulScores?.completed_at ?? health.latestSuccessfulScores?.started_at)}`}
          />
          <StatusCard
            attention={Boolean(scheduleCooling)}
            label="NFL SCHEDULE"
            value={scheduleCooling ? `${health.scheduleProviderCircuit!.consecutive_failures} failed refreshes` : "Automatic refresh ready"}
            detail={scheduleCooling ? `Next retry ${localTime(health.scheduleProviderCircuit!.next_retry_at)}` : "No provider cooldown is active."}
          />
          <StatusCard
            attention={health.providerAllowance !== null && health.providerAllowance < 25}
            label="PROVIDER ALLOWANCE"
            value={health.providerAllowance === null ? "Not reported yet" : `${health.providerAllowance} credits remaining`}
            detail={`${health.reminderHealth.overdueScheduled} held reminders · ${health.retention.candidates.toLocaleString()} old operational records`}
          />
        </div>

        <details className="mt-4 border border-zinc-400 bg-white p-4">
          <summary className="cursor-pointer font-bold">Emergency manual controls</summary>
          <p className="mt-2 text-sm text-zinc-700">These runs bypass provider cooldown timing only. Authentication, overlap leases, quota reserve, line locks, week pins, and atomic database checks remain enforced.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="border border-zinc-900 px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={action !== null || loading} onClick={() => void runEmergency("scores")} type="button">{action === "scores" ? "Checking scores..." : "Run score check now"}</button>
            <button className="border border-zinc-900 px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={action !== null || loading} onClick={() => void runEmergency("schedule")} type="button">{action === "schedule" ? "Refreshing schedule..." : "Override schedule cooldown"}</button>
          </div>
        </details>
      </> : null}
    </section>
  );
}
