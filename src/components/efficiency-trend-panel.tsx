"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Point = { date: string; creditsPerFinal: number | null; productiveRate: number | null };
function points(values: Array<number | null>, max: number) { return values.map((value, index) => value === null ? null : `${(index / Math.max(1, values.length - 1)) * 100},${100 - (value / Math.max(1, max)) * 84 - 8}`).filter(Boolean).join(" "); }

export default function EfficiencyTrendPanel() {
  const [history, setHistory] = useState<Point[]>([]);
  useEffect(() => { let active = true; void fetchWithSession("/api/admin/grading-dashboard").then((response) => response.json()).then((payload) => { if (active && payload.metrics?.efficiency?.history) setHistory(payload.metrics.efficiency.history); }).catch(() => undefined); return () => { active = false; }; }, []);
  const credits = history.map((point) => point.creditsPerFinal);
  const productive = history.map((point) => point.productiveRate);
  if (!history.some((point) => point.creditsPerFinal !== null || point.productiveRate !== null)) return null;
  return <div className="mt-5 border border-zinc-300 bg-white p-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><div><h3 className="font-serif text-xl font-bold">Provider efficiency over time</h3><p className="mt-1 text-sm text-zinc-600">Thirty-day view. Lower credits per final is better; higher productive-check percentage is better.</p></div><div className="flex gap-4 text-xs font-bold"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-700" />Credits / final</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-700" />Productive checks</span></div></div><div className="mt-4 overflow-x-auto"><svg aria-label="Credits per final and productive check percentage over time" className="h-56 min-w-[36rem] w-full" role="img" viewBox="0 0 100 108" preserveAspectRatio="none"><line x1="0" y1="8" x2="100" y2="8" stroke="#d4d4d8" strokeWidth=".5" /><line x1="0" y1="50" x2="100" y2="50" stroke="#d4d4d8" strokeWidth=".5" /><line x1="0" y1="92" x2="100" y2="92" stroke="#d4d4d8" strokeWidth=".5" /><polyline fill="none" stroke="#4338ca" strokeWidth="1.5" points={points(credits, Math.max(10, ...credits.filter((value): value is number => value !== null)))} /><polyline fill="none" stroke="#047857" strokeWidth="1.5" points={points(productive, 100)} />{history.map((point, index) => <g key={point.date}><title>{point.date}: {point.creditsPerFinal ?? "—"} credits/final · {point.productiveRate ?? "—"}% productive</title>{point.creditsPerFinal !== null ? <circle cx={(index / Math.max(1, history.length - 1)) * 100} cy={100 - (point.creditsPerFinal / Math.max(10, ...credits.filter((value): value is number => value !== null))) * 84 - 8} r="1.2" fill="#4338ca" /> : null}{point.productiveRate !== null ? <circle cx={(index / Math.max(1, history.length - 1)) * 100} cy={100 - (point.productiveRate / 100) * 84 - 8} r="1.2" fill="#047857" /> : null}</g>)}</svg></div><div className="mt-2 flex justify-between text-[11px] text-zinc-500"><span>{history[0]?.date}</span><span>{history.at(-1)?.date}</span></div></div>;
}
