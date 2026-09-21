"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Point = { date: string; creditsPerFinal: number | null; productiveRate: number | null };

function segments(values: Array<number | null>, max: number) {
  const groups: string[][] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null) { if (current.length) groups.push(current); current = []; return; }
    current.push(`${(index / Math.max(1, values.length - 1)) * 100},${100 - (value / Math.max(1, max)) * 82 - 9}`);
  });
  if (current.length) groups.push(current);
  return groups;
}

export default function EfficiencyTrendPanel() {
  const [history, setHistory] = useState<Point[]>([]);
  useEffect(() => { let active = true; void fetchWithSession("/api/admin/grading-dashboard").then((response) => response.json()).then((payload) => { if (active && payload.metrics?.efficiency?.history) setHistory(payload.metrics.efficiency.history); }).catch(() => undefined); return () => { active = false; }; }, []);
  const creditMax = Math.max(10, ...history.map((point) => point.creditsPerFinal ?? 0));
  if (!history.some((point) => point.creditsPerFinal !== null || point.productiveRate !== null)) return null;
  return <div className="mt-5 border border-zinc-300 bg-white p-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><div><h3 className="font-serif text-xl font-bold">Provider efficiency over time</h3><p className="mt-1 text-sm text-zinc-600">Thirty-day view with separate scales so neither metric distorts the other.</p></div><div className="flex gap-4 text-xs font-bold"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-700" />Credits / final</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-700" />Productive checks</span></div></div><div className="mt-4 overflow-x-auto"><svg aria-label="Credits per final and productive check percentage over time" className="h-72 min-w-[38rem] w-full" role="img" viewBox="0 0 100 150" preserveAspectRatio="none"><text x="0" y="6" fill="#52525b" fontSize="4">Credits / final · lower is better</text><line x1="0" y1="12" x2="100" y2="12" stroke="#e4e4e7" strokeWidth=".5" /><line x1="0" y1="52" x2="100" y2="52" stroke="#e4e4e7" strokeWidth=".5" /><line x1="0" y1="92" x2="100" y2="92" stroke="#e4e4e7" strokeWidth=".5" />{segments(history.map((point) => point.creditsPerFinal), creditMax).map((line, index) => <polyline fill="none" key={`credits-${index}`} points={line.map((point) => { const [x, y] = point.split(","); return `${x},${Number(y) * .42 + 8}`; }).join(" ")} stroke="#4338ca" strokeWidth="1.5" />)}<text x="0" y="83" fill="#52525b" fontSize="4">Productive checks · higher is better</text><line x1="0" y1="89" x2="100" y2="89" stroke="#e4e4e7" strokeWidth=".5" /><line x1="0" y1="119" x2="100" y2="119" stroke="#e4e4e7" strokeWidth=".5" /><line x1="0" y1="149" x2="100" y2="149" stroke="#e4e4e7" strokeWidth=".5" />{segments(history.map((point) => point.productiveRate), 100).map((line, index) => <polyline fill="none" key={`productive-${index}`} points={line.map((point) => { const [x, y] = point.split(","); return `${x},${Number(y) * .36 + 89}`; }).join(" ")} stroke="#047857" strokeWidth="1.5" />)}{history.map((point, index) => <g key={point.date}><title>{point.date}: {point.creditsPerFinal ?? "—"} credits/final · {point.productiveRate ?? "—"}% productive</title>{point.creditsPerFinal !== null ? <circle cx={(index / Math.max(1, history.length - 1)) * 100} cy={((100 - (point.creditsPerFinal / creditMax) * 82 - 9) * .42) + 8} r="1.1" fill="#4338ca" /> : null}{point.productiveRate !== null ? <circle cx={(index / Math.max(1, history.length - 1)) * 100} cy={((100 - (point.productiveRate / 100) * 82 - 9) * .36) + 89} r="1.1" fill="#047857" /> : null}</g>)}</svg></div><div className="mt-2 flex justify-between text-[11px] text-zinc-500"><span>{history[0]?.date}</span><span>{history.at(-1)?.date}</span></div></div>;
}
