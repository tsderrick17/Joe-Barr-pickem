"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Point = { date: string; creditsPerFinal: number | null; productiveRate: number | null };

const CHART_WIDTH = 760;
const CHART_HEIGHT = 330;
const LEFT = 58;
const RIGHT = 12;
const PLOT_WIDTH = CHART_WIDTH - LEFT - RIGHT;
const PANEL_HEIGHT = 92;
const CREDIT_TOP = 36;
const PRODUCTIVE_TOP = 180;

function xFor(index: number, count: number) {
  return LEFT + (index / Math.max(1, count - 1)) * PLOT_WIDTH;
}

function yFor(value: number, max: number, top: number) {
  return top + PANEL_HEIGHT - (value / Math.max(1, max)) * PANEL_HEIGHT;
}

function segments(values: Array<number | null>, max: number, top: number) {
  const groups: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length) groups.push(current);
      current = [];
      return;
    }
    current.push({ x: xFor(index, values.length), y: yFor(value, max, top) });
  });
  if (current.length) groups.push(current);
  return groups;
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function EfficiencyTrendPanel() {
  const [history, setHistory] = useState<Point[]>([]);
  useEffect(() => {
    let active = true;
    void fetchWithSession("/api/admin/grading-dashboard")
      .then((response) => response.json())
      .then((payload) => { if (active && payload.metrics?.efficiency?.history) setHistory(payload.metrics.efficiency.history); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const observedHistory = useMemo(() => {
    const first = history.findIndex((point) => point.creditsPerFinal !== null || point.productiveRate !== null);
    const last = history.findLastIndex((point) => point.creditsPerFinal !== null || point.productiveRate !== null);
    return first >= 0 && last >= first ? history.slice(first, last + 1) : [];
  }, [history]);
  if (!observedHistory.length) return null;

  const creditMax = Math.max(10, ...observedHistory.map((point) => point.creditsPerFinal ?? 0));
  const creditLines = segments(observedHistory.map((point) => point.creditsPerFinal), creditMax, CREDIT_TOP);
  const productiveLines = segments(observedHistory.map((point) => point.productiveRate), 100, PRODUCTIVE_TOP);
  const xTicks = [0, Math.floor((observedHistory.length - 1) / 2), observedHistory.length - 1];
  const grid = (top: number) => [0, 50, 100].map((percent) => {
    const y = top + PANEL_HEIGHT - (percent / 100) * PANEL_HEIGHT;
    return <g key={`${top}-${percent}`}><line x1={LEFT} y1={y} x2={CHART_WIDTH - RIGHT} y2={y} stroke="#e4e4e7" strokeWidth="1" /><text x={LEFT - 8} y={y + 4} fill="#71717a" fontSize="11" textAnchor="end">{percent}{top === CREDIT_TOP ? "" : "%"}</text></g>;
  });
  const line = (points: Array<{ x: number; y: number }>, color: string) => <polyline fill="none" points={points.map((point) => `${point.x},${point.y}`).join(" ")} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />;

  return <div className="mt-5 border border-zinc-300 bg-white p-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><div><h3 className="font-serif text-xl font-bold">Provider efficiency over time</h3><p className="mt-1 text-sm text-zinc-600">Observed days only; each metric has its own readable scale.</p></div><div className="flex gap-4 text-xs font-bold"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-700" />Credits / final</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-700" />Productive checks</span></div></div><div className="mt-4 overflow-x-auto"><svg aria-label="Credits per final and productive check percentage over time" className="h-auto min-w-[38rem] w-full" role="img" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}><text x={LEFT} y="18" fill="#52525b" fontSize="12" fontWeight="700">Credits / final · lower is better</text>{grid(CREDIT_TOP)}{creditLines.map((points, index) => <g key={`credits-${index}`}>{line(points, "#4338ca")}{points.map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill="#4338ca" />)}</g>)}<text x={LEFT} y="162" fill="#52525b" fontSize="12" fontWeight="700">Productive checks · higher is better</text>{grid(PRODUCTIVE_TOP)}{productiveLines.map((points, index) => <g key={`productive-${index}`}>{line(points, "#047857")}{points.map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" fill="#047857" />)}</g>)}{observedHistory.map((point) => <title key={point.date}>{point.date}: {point.creditsPerFinal ?? "—"} credits/final · {point.productiveRate ?? "—"}% productive</title>)}{xTicks.map((index) => <text key={index} x={xFor(index, observedHistory.length)} y="320" fill="#71717a" fontSize="11" textAnchor={index === 0 ? "start" : index === observedHistory.length - 1 ? "end" : "middle"}>{formatDate(observedHistory[index]?.date)}</text>)}</svg></div></div>;
}
