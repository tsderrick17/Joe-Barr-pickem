"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Result = {
  checkedAt: string;
  status: "healthy" | "attention";
  checks: Array<{ id: string; label: string; detail: string; passed: boolean }>;
};

async function fetchRehearsal() {
  const response = await fetchWithSession("/api/admin/season-recovery-rehearsal");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The safe season rehearsal could not be completed.");
  return data as Result;
}

export default function SeasonRecoveryRehearsal() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function run() {
    setLoading(true);
    setError("");
    try {
      setResult(await fetchRehearsal());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The safe season rehearsal could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void run(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="border-b-2 border-zinc-900 py-8" id="season-recovery-rehearsal">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-2xl font-bold">Season & recovery rehearsal</h2>
        <p className="mt-2 text-zinc-700">A safe, in-memory walkthrough of settlement, late data, playoff eligibility, and season closeout. It never reads or changes player records.</p>
      </div>
      <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={run} type="button">{loading ? "Checking..." : "Run safe rehearsal"}</button>
    </div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {result ? <div className={`mt-5 border p-4 ${result.status === "healthy" ? "border-green-800 bg-green-50" : "border-red-700 bg-red-50"}`}>
      <p className="font-bold">{result.status === "healthy" ? "Season and recovery rehearsal passed" : "Season rehearsal found a path needing review"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.checks.map((check) => <article className={`border p-3 ${check.passed ? "border-green-300 bg-white text-green-950" : "border-red-300 bg-white text-red-950"}`} key={check.id}>
          <p className="text-sm font-bold">{check.passed ? "PASS" : "FAIL"} · {check.label}</p>
          <p className="mt-1 text-sm leading-5">{check.detail}</p>
        </article>)}
      </div>
      <p className="mt-4 text-xs text-zinc-600">Checked {new Date(result.checkedAt).toLocaleString()}.</p>
    </div> : null}
  </section>;
}
