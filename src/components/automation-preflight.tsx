"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Group = "schedules" | "authorization" | "providers" | "alerts";
type Check = { check_id: string; label: string; passed: boolean; detail: string; group: Group };
type Result = { checkedAt: string; status: "healthy" | "attention"; checks: Check[] };
const groupLabels: Record<Group, string> = {
  schedules: "Schedules",
  authorization: "Authorization",
  providers: "External services",
  alerts: "Commissioner alerts",
};

async function fetchPreflight() {
  const response = await fetchWithSession("/api/admin/automation-preflight");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Launch preflight could not be completed.");
  return data as Result;
}

export default function AutomationPreflight() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function run() {
    setLoading(true);
    setError("");
    try { setResult(await fetchPreflight()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Launch preflight could not be completed."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const initial = await fetchPreflight();
        if (!cancelled) setResult(initial);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Launch preflight could not be completed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return <section className="border-b-2 border-zinc-900 py-8" id="automation-preflight">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs font-black tracking-[0.16em] text-zinc-600">BEFORE GAME DAY</p>
        <h2 className="mt-1 font-serif text-2xl font-bold">Launch preflight</h2>
        <p className="mt-2 text-zinc-700">Actively verifies every schedule, the watchdog heartbeat, cron authorization, the zero-credit NFL provider check, Brevo, the PickemJB sender, and a Commissioner alert address. It sends no email and changes no pool records.</p>
      </div>
      <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={() => void run()} type="button">{loading ? "Checking launch systems…" : "Run launch preflight"}</button>
    </div>
    {error ? <p className="mt-4 border-l-4 border-red-700 bg-red-50 p-4 font-semibold text-red-900">{error}</p> : null}
    {result ? <div className={`mt-5 border-2 p-4 ${result.status === "healthy" ? "border-green-800 bg-green-50" : "border-red-700 bg-red-50"}`}>
      <p className="font-serif text-xl font-bold">{result.status === "healthy" ? "Every launch dependency is ready" : "Launch dependencies need attention"}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(Object.keys(groupLabels) as Group[]).map((group) => {
          const checks = result.checks.filter((item) => item.group === group);
          if (!checks.length) return null;
          return <section className="border border-zinc-300 bg-white p-4" key={group}>
            <h3 className="text-xs font-black tracking-[0.14em] text-zinc-600">{groupLabels[group].toUpperCase()}</h3>
            <ul className="mt-3 divide-y divide-zinc-200">
              {checks.map((item) => <li className="py-3 first:pt-0 last:pb-0" key={item.check_id}>
                <p className={`text-sm font-bold ${item.passed ? "text-green-800" : "text-red-800"}`}>{item.passed ? "READY" : "REVIEW"} · {item.label}</p>
                <p className="mt-1 text-sm leading-5 text-zinc-700">{item.detail}</p>
              </li>)}
            </ul>
          </section>;
        })}
      </div>
      <p className="mt-4 text-xs text-zinc-600">Checked {new Date(result.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}.</p>
    </div> : null}
  </section>;
}
