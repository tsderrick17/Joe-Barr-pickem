"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Check = { id: string; label: string; detail: string; state: "ready" | "setup" | "attention" | "manual" };
type Result = { checkedAt: string; status: "ready" | "setup" | "attention"; checks: Check[] };

async function loadChecklist() {
  const response = await fetchWithSession("/api/admin/opening-week-checklist");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "The opening-week checklist could not be checked.");
  return payload as Result;
}

const heading = {
  ready: ["Opening Week is ready", "The launch prerequisites are in place. Complete the one voluntary player check before kickoff."],
  setup: ["Opening Week has setup left", "Nothing was changed. Finish the listed setup items, then refresh this read-only checklist."],
  attention: ["Opening Week needs attention", "A real condition needs review before the pool opens."],
} as const;

export default function OpeningWeekChecklist() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function run() {
    setLoading(true); setError("");
    try { setResult(await loadChecklist()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The opening-week checklist could not be checked."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void run(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <section className="border-b-2 border-zinc-900 py-8" id="opening-week-checklist">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="font-serif text-2xl font-bold">Opening Week checklist</h2><p className="mt-2 text-zinc-700">A read-only launch rehearsal. It never activates a period, changes a pick, imports games, or sends email.</p></div>
      <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={run} type="button">{loading ? "Checking..." : "Refresh checklist"}</button>
    </div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {result ? <div className={`mt-5 border p-4 ${result.status === "attention" ? "border-red-700 bg-red-50" : result.status === "setup" ? "border-amber-600 bg-amber-50" : "border-green-800 bg-green-50"}`}>
      <p className="font-bold">{heading[result.status][0]}</p><p className="mt-1 text-sm">{heading[result.status][1]}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{result.checks.map((check) => <article className="border border-zinc-300 bg-white p-3" key={check.id}>
        <p className={`text-sm font-bold ${check.state === "attention" ? "text-red-800" : check.state === "setup" ? "text-amber-800" : check.state === "manual" ? "text-sky-800" : "text-green-800"}`}>{check.state === "attention" ? "REVIEW" : check.state === "setup" ? "SETUP" : check.state === "manual" ? "ONE-MINUTE CHECK" : "READY"} · {check.label}</p>
        <p className="mt-1 text-sm leading-5 text-zinc-800">{check.detail}</p>
      </article>)}</div>
      <p className="mt-4 text-xs text-zinc-600">Checked {new Date(result.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}.</p>
    </div> : null}
  </section>;
}
