"use client";

import { useState } from "react";
import ProviderChart from "@/components/provider-chart";

export type LatencyMetric = {
  settlementLatency: {
    averageMinutes: number | null;
    slowestMinutes: number | null;
    samples: number;
    history: Array<{ label: string; shortLabel: string; minutes: number }>;
  };
  comparison: {
    previousPeriod: string | null;
    previousAverageMinutes: number | null;
    deltaMinutes: number | null;
    history: Array<{ id: string; label: string; shortLabel: string; averageMinutes: number | null; samples: number }>;
  };
};

function minutes(value: number | null) {
  return value === null ? "-" : `${value}m`;
}

export default function LatencyViewsPanel({ metric, embedded = false }: { metric: LatencyMetric; embedded?: boolean }) {
  const [view, setView] = useState<"period" | "trend">("period");
  const trend = view === "trend";
  const average = trend ? metric.comparison.previousAverageMinutes : metric.settlementLatency.averageMinutes;
  const delta = metric.comparison.deltaMinutes;

  const periodPoints = metric.settlementLatency.history.map((point) => ({
    label: point.label,
    shortLabel: point.shortLabel,
    values: { latency: point.minutes, average: metric.settlementLatency.averageMinutes },
    note: "Normalized from the pooled kickoff window to the accepted final.",
  }));
  const trendPoints = metric.comparison.history.map((point) => ({
    label: `${point.label} · ${point.samples} settled game${point.samples === 1 ? "" : "s"}`,
    shortLabel: point.label,
    values: { average: point.averageMinutes },
    note: `${point.samples} settled sample${point.samples === 1 ? "" : "s"}`,
  }));

  return <section className={embedded ? "mt-4 min-w-0" : "mt-5 min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-400">Grading war room</p>
        <h3 className="mt-1 font-serif text-xl font-bold">Settlement latency</h3>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">{trend ? "Average accepted-final latency across scoring periods." : "Accepted-final latency for each settled game in the selected period."}</p>
      </div>
      <div className="flex shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-xs font-bold" role="tablist" aria-label="Settlement latency view">
        <button className={`rounded-md px-3 py-2 transition ${!trend ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-white"}`} onClick={() => setView("period")} role="tab" aria-selected={!trend} type="button">Current period</button>
        <button className={`rounded-md px-3 py-2 transition ${trend ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-white"}`} onClick={() => setView("trend")} role="tab" aria-selected={trend} type="button">Period trend</button>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-lg border border-zinc-100 bg-zinc-50/70 px-4 py-3">
      <div><p className="text-xs font-black tracking-wide text-zinc-500">{trend ? "PRIOR PERIOD AVERAGE" : "PERIOD AVERAGE"}</p><p className="font-serif text-2xl font-bold tabular-nums">{minutes(average)}</p><p className="text-xs text-zinc-500">{trend ? (metric.comparison.previousPeriod ?? "No prior period") : `${metric.settlementLatency.samples} settled samples`}</p></div>
      {trend ? <div className="text-right"><p className="text-xs font-black tracking-wide text-zinc-500">VS PRIOR PERIOD</p><p className={`font-serif text-2xl font-bold tabular-nums ${delta === null ? "text-zinc-900" : delta > 0 ? "text-red-700" : "text-emerald-700"}`}>{delta === null ? "-" : `${delta > 0 ? "+" : ""}${delta}m`}</p><p className="text-xs text-zinc-500">change from the preceding period</p></div> : <div className="text-right"><p className="text-xs font-black tracking-wide text-zinc-500">SLOWEST HANDOFF</p><p className="font-serif text-2xl font-bold tabular-nums">{minutes(metric.settlementLatency.slowestMinutes)}</p><p className="text-xs text-zinc-500">kickoff to accepted final</p></div>}
    </div>
    <div className="mt-4">
      {trend ? <ProviderChart label="Average settlement latency by scoring period" points={trendPoints} series={[{ key: "average", label: "Average minutes", color: "#2563eb", suffix: "m" }]} yScale="tight" yAxisLabel="Minutes to final" /> : <ProviderChart label="Settlement latency by game" points={periodPoints} series={[{ key: "latency", label: "Minutes to final", color: "#dc2626", kind: "bar", suffix: "m" }, { key: "average", label: "Period average", color: "#4f46e5", dash: "6 5", suffix: "m" }]} yScale="tight" yAxisLabel="Minutes to final" />}
    </div>
  </section>;
}
