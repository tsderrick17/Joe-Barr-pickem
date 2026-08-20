"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Status = {
  seasonYear: number; seasonState: string | null; regularPeriods: number;
  loadedGames: number; complete: boolean;
  lastRun: { status: string; completed_at: string | null; error_message: string | null; details: { outcome?: string } } | null;
  turnover: {
    status: "blocked" | "completed"; completed_at: string | null; blockers: string[];
    preserved_counts: Record<string, number>; deleted_counts: Record<string, number>;
  } | null;
};

function countValues(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

export default function SeasonBootstrapStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetchWithSession("/api/admin/season-bootstrap-status");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Season bootstrap status could not be loaded.");
    setStatus(data);
  }
  useEffect(() => {
    let cancelled = false;
    async function loadInitialStatus() {
      try {
        const response = await fetchWithSession("/api/admin/season-bootstrap-status");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Season bootstrap status could not be loaded.");
        if (!cancelled) setStatus(data);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Season bootstrap status could not be loaded.");
      }
    }
    void loadInitialStatus();
    return () => { cancelled = true; };
  }, []);
  async function runNow() {
    setBusy(true); setError("");
    try {
      const response = await fetchWithSession("/api/admin/season-bootstrap-status", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Automatic bootstrap could not run.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Automatic bootstrap could not run."); }
    finally { setBusy(false); }
  }
  return (
    <section className="border-b-2 border-zinc-900 py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-zinc-600">AUTOMATIC SEASON HANDOFF</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">Full schedule bootstrap</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-700">Beginning August 1, automation checks daily for all 272 games. A partial or malformed feed changes nothing. Once complete, the schedule is pinned and further provider calls stop.</p>
        </div>
        <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={busy} onClick={runNow} type="button">{busy ? "Running…" : "Run automatic check now"}</button>
      </div>
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
      {status ? <div className={`mt-4 border p-4 ${status.complete ? "border-green-800 bg-green-50" : "border-amber-700 bg-amber-50"}`}>
        <p className="font-bold">{status.complete ? `${status.seasonYear} schedule is fully loaded` : `${status.seasonYear} is waiting safely`}</p>
        <p className="mt-1 text-sm">{status.loadedGames}/272 games pinned · {status.regularPeriods}/18 regular weeks ready · season state: {status.seasonState ?? "not created yet"}</p>
        <p className="mt-2 text-xs text-zinc-600">Last automatic attempt: {status.lastRun?.completed_at ? new Date(status.lastRun.completed_at).toLocaleString() : "not run yet"}{status.lastRun?.details?.outcome ? ` · ${status.lastRun.details.outcome.replaceAll("_", " ")}` : ""}</p>
      </div> : null}
      {status?.turnover ? <div className={`mt-3 border p-4 ${status.turnover.status === "completed" ? "border-green-800 bg-green-50" : "border-red-800 bg-red-50"}`}>
        <p className="font-bold">{status.turnover.status === "completed" ? `${status.seasonYear} season turnover is certified` : "Season turnover needs Commissioner review"}</p>
        {status.turnover.status === "completed" ? <>
          <p className="mt-1 text-sm">Official games, lines, picks, championships, and message receipts were preserved. {countValues(status.turnover.deleted_counts).toLocaleString()} disposable record{countValues(status.turnover.deleted_counts) === 1 ? "" : "s"} were cleared.</p>
          <p className="mt-2 text-xs text-zinc-600">Completed: {status.turnover.completed_at ? new Date(status.turnover.completed_at).toLocaleString() : "recorded"}</p>
        </> : <ul className="mt-2 list-disc pl-5 text-sm">
          {status.turnover.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
        </ul>}
      </div> : null}
    </section>
  );
}
