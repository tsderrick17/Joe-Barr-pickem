"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Plan = { id: string; label: string; checksPerGame: number; expectedMinutesAfterFinal: number; description: string; weeklyCredits: number; monthlyCredits: number; periodCredits: number };

export default function PollingStrategyPanel() {
  const [polling, setPolling] = useState<{ recommendedPlan: string; plans: Plan[] } | null>(null);
  useEffect(() => { let active = true; void fetchWithSession("/api/admin/grading-dashboard").then((response) => response.json()).then((payload) => { if (active && payload.polling) setPolling(payload.polling); }).catch(() => undefined); return () => { active = false; }; }, []);
  if (!polling) return null;
  return <div className="mt-5 border border-zinc-300 bg-white p-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><div><h3 className="font-serif text-xl font-bold">Polling strategy simulator</h3><p className="mt-1 text-sm text-zinc-600">Projected score-provider cost for the current slate. This is advisory and does not change production automatically.</p></div><span className="border border-amber-700 bg-amber-50 px-2 py-1 text-xs font-black uppercase tracking-wide">Approval required</span></div><div className="mt-4 grid gap-3 md:grid-cols-3">{polling.plans.map((plan) => <div className={`border p-3 ${plan.id === polling.recommendedPlan ? "border-green-700 bg-green-50" : "border-zinc-200"}`} key={plan.id}><div className="flex items-center justify-between gap-2"><p className="font-bold">{plan.label}</p>{plan.id === polling.recommendedPlan ? <span className="text-xs font-black uppercase tracking-wide text-green-800">Suggested</span> : null}</div><p className="mt-2 text-sm">{plan.description}</p><dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between gap-2"><dt className="text-zinc-600">Checks / game</dt><dd className="font-semibold">{plan.checksPerGame}</dd></div><div className="flex justify-between gap-2"><dt className="text-zinc-600">This slate</dt><dd className="font-semibold">{plan.periodCredits} credits</dd></div><div className="flex justify-between gap-2"><dt className="text-zinc-600">30-day projection</dt><dd className="font-semibold">{plan.monthlyCredits} credits</dd></div></dl></div>)}</div><p className="mt-3 text-xs text-zinc-600">Assumes two provider credits per score check and a 4.33-week month. Review the balance before any future apply action.</p></div>;
}
