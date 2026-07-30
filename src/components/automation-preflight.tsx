"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Result = { checkedAt: string; status: "healthy" | "attention"; checks: Array<{ check_id: string; label: string; passed: boolean; detail: string }> };

async function fetchPreflight() {
  const response = await fetchWithSession("/api/admin/automation-preflight");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Automation preflight could not be completed.");
  return data as Result;
}

export default function AutomationPreflight() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function run() { setLoading(true); setError(""); try { setResult(await fetchPreflight()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Automation preflight could not be completed."); } finally { setLoading(false); } }
  useEffect(() => { let cancelled = false; async function load() { try { const initial = await fetchPreflight(); if (!cancelled) setResult(initial); } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Automation preflight could not be completed."); } finally { if (!cancelled) setLoading(false); } } void load(); return () => { cancelled = true; }; }, []);
  return <section className="border-b-2 border-zinc-900 py-8" id="automation-preflight">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Automation Preflight</h2><p className="mt-2 text-zinc-700">Confirms the required Supabase schedules and shared automation secret before gameday.</p></div><button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={run} type="button">{loading ? "Checking..." : "Run automation preflight"}</button></div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {result ? <div className={`mt-5 border p-4 ${result.status === "healthy" ? "border-green-800 bg-green-50" : "border-red-700 bg-red-50"}`}><p className="font-bold">{result.status === "healthy" ? "Automation prerequisites are ready" : "Automation prerequisites need attention"}</p><ul className="mt-3 space-y-2 text-sm">{result.checks.map((check) => <li key={check.check_id}><span className="font-bold">{check.passed ? "PASS" : "FAIL"} · {check.label}</span><span className="block text-zinc-700">{check.detail}</span></li>)}</ul></div> : null}
  </section>;
}
