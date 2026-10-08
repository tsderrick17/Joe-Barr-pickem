"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type ReadinessCheck = { id: string; label: string; detail: string; state: "pass" | "setup" | "attention" };
type Result = { checkedAt: string; status: "ready" | "setup" | "attention"; checks: ReadinessCheck[] };

async function fetchReadiness() {
  const response = await fetchWithSession("/api/admin/season-readiness");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Season readiness could not be checked.");
  return payload as Result;
}

const copy = {
  ready: { heading: "Season systems are ready", detail: "The live schedule, continuity rules, playoff capacity, and reminder queue agree." },
  setup: { heading: "Season systems are ready for the regular season", detail: "No integrity problem was found. The postseason schedule is simply not loaded yet." },
  attention: { heading: "Season readiness needs attention", detail: "One or more safeguards found a real condition to review before game day." },
};

export default function SeasonReadiness() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function run() {
    setLoading(true);
    setError("");
    try { setResult(await fetchReadiness()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Season readiness could not be checked."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void run(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="commissioner-tool" id="season-readiness">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-2xl font-bold">Season Readiness</h2>
        <p className="mt-2 text-(color:--themed-text-29)">One read-only check for handoffs, game timing, playoff capacity, and the reminder queue.</p>
      </div>
      <button className="border border-zinc-900 bg-(color:--themed-bg-26) px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={run} type="button">{loading ? "Checking..." : "Refresh readiness"}</button>
    </div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {result ? <div className={`mt-5 border p-4 ${result.status === "attention" ? "border-(color:--themed-border-24) bg-(color:--themed-bg-24)" : result.status === "setup" ? "border-(color:--themed-border-16) bg-(color:--themed-bg-21)" : "border-(color:--themed-border-21) bg-(color:--themed-bg-23)"}`}>
      <p className="font-bold">{copy[result.status].heading}</p>
      <p className="mt-1 text-sm">{copy[result.status].detail}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.checks.map((item) => <article className="border border-zinc-300 bg-(color:--themed-bg-26) p-3" key={item.id}>
          <p className={`text-sm font-bold ${item.state === "attention" ? "text-red-800" : item.state === "setup" ? "text-(color:--themed-text-21)" : "text-green-800"}`}>{item.state === "attention" ? "REVIEW" : item.state === "setup" ? "LATER" : "READY"} · {item.label}</p>
          <p className="mt-1 text-sm leading-5 text-(color:--themed-text-30)">{item.detail}</p>
        </article>)}
      </div>
      <p className="mt-4 text-xs text-(color:--themed-text-28)">Checked {new Date(result.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}.</p>
    </div> : null}
  </section>;
}
