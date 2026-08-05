"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Health = {
  status: "healthy" | "attention";
  problems: string[];
  latestLocks: { completed_at: string | null } | null;
  latestScores: { completed_at: string | null } | null;
  reminderHealth: { overdueScheduled: number; staleSending: number; recentEmailFailures: number };
  providerAllowance: number | null;
  retention: { candidates: number; cutoff: string };
};

async function fetchHealth() {
  const response = await fetchWithSession("/api/admin/automation-health");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Automation health could not be loaded.");
  }
  return data as Health;
}

export default function AutomationHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialHealth() {
      try {
        const result = await fetchHealth();
        if (!cancelled) setHealth(result);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Automation health could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setHealth(await fetchHealth());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Automation health could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-b-2 border-zinc-900 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold">Automation Health</h2>
          <p className="mt-2 text-zinc-700">
            Detects failed or stale automation before it becomes a line-lock, scoring, or reminder-delivery problem.
          </p>
        </div>
        <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={refresh} type="button">
          {loading ? "Checking..." : "Refresh health"}
        </button>
      </div>

      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}

      {health ? (
        <div className={`mt-5 border p-4 ${health.status === "healthy" ? "border-green-800 bg-green-50 text-green-950" : "border-red-700 bg-red-50 text-red-950"}`}>
          <p className="font-bold">{health.status === "healthy" ? "Automation is healthy" : "Automation needs attention"}</p>
          {health.problems.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {health.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          ) : <p className="mt-1 text-sm">No overdue lines, stale scoring checks, or stuck reminders are currently detected.</p>}
          <p className="mt-3 text-xs">
            Latest line lock: {health.latestLocks?.completed_at ? new Date(health.latestLocks.completed_at).toLocaleString() : "not recorded"}
            {" / "}
            Latest score sync: {health.latestScores?.completed_at ? new Date(health.latestScores.completed_at).toLocaleString() : "not recorded"}
            {" / "}
            Reminder queue: {health.reminderHealth.overdueScheduled} held, {health.reminderHealth.staleSending} sending, {health.reminderHealth.recentEmailFailures} recent failures
            {" / "}
            Odds allowance: {health.providerAllowance === null ? "not yet reported" : `${health.providerAllowance} credits remaining`}
            {" / "}
            Retention review: {health.retention.candidates.toLocaleString()} operational records older than 180 days
          </p>
        </div>
      ) : null}
    </section>
  );
}
