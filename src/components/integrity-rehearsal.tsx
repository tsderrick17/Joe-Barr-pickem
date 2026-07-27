"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Result = {
  checkedAt: string;
  status: "healthy" | "attention";
  checks: Array<{ id: string; label: string; detail: string; failed: number }>;
};

async function fetchRehearsal() {
  const response = await fetchWithSession("/api/admin/integrity-rehearsal");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Integrity rehearsal could not be completed.");
  return data as Result;
}

export default function IntegrityRehearsal() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function run() {
    setLoading(true);
    setError("");
    try {
      setResult(await fetchRehearsal());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Integrity rehearsal could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialRehearsal() {
      try {
        const initialResult = await fetchRehearsal();
        if (!cancelled) setResult(initialResult);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Integrity rehearsal could not be completed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialRehearsal();
    return () => { cancelled = true; };
  }, []);

  return <section className="border-b-2 border-zinc-900 py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-2xl font-bold">Integrity Rehearsal</h2>
        <p className="mt-2 text-zinc-700">Read-only audit of live records. It does not alter games, picks, scores, or Survivor entries.</p>
      </div>
      <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={run} type="button">{loading ? "Checking..." : "Run integrity rehearsal"}</button>
    </div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {result ? <div className={`mt-5 border p-4 ${result.status === "healthy" ? "border-green-800 bg-green-50" : "border-red-700 bg-red-50"}`}>
      <p className="font-bold">{result.status === "healthy" ? "Season records pass the integrity rehearsal" : "Integrity rehearsal found records needing review"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.checks.map((check) => <article className={`border p-3 ${check.failed ? "border-red-300 bg-white text-red-950" : "border-green-300 bg-white text-green-950"}`} key={check.id}>
          <p className="text-sm font-bold">{check.failed ? "FAIL" : "PASS"} · {check.label}</p>
          <p className="mt-1 text-sm leading-5">{check.detail}</p>
        </article>)}
      </div>
      <p className="mt-4 text-xs text-zinc-600">Checked {new Date(result.checkedAt).toLocaleString()}.</p>
    </div> : null}
  </section>;
}
