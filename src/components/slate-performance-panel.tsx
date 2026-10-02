"use client";

import { useState } from "react";
import ProviderChart from "@/components/provider-chart";
import LatencyViewsPanel, { type LatencyMetric } from "@/components/latency-views-panel";
import { rollingCreditsPerGame15Days } from "@/lib/provider-chart-data.js";
import type { EfficiencyPoint, EfficiencySummary } from "@/components/efficiency-trend-panel";

const date = (value: string, time = false) => new Date(value).toLocaleString("en-US", {
  timeZone: "America/New_York", month: "short", day: "numeric",
  ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
});
const number = (value: number | null) => value === null ? "-" : value.toLocaleString("en-US", { maximumFractionDigits: 1 });

export default function SlatePerformancePanel({ history, summary, latencyMetric }: {
  history: EfficiencyPoint[];
  summary: EfficiencySummary;
  latencyMetric: LatencyMetric;
}) {
  const [range, setRange] = useState<"all" | "14">("all");
  const first = range === "14" ? Math.max(0, history.length - 14) : 0;
  const observed = history.slice(first);
  const attributed = history.filter((point) => point.creditsPerGame !== null && point.settledGames > 0);
  const attributedGames = attributed.reduce((total, point) => total + point.settledGames, 0);
  const creditsPerGame = attributedGames ? attributed.reduce((total, point) => total + point.credits, 0) / attributedGames : null;
  const settled = history.filter((point) => point.latencyMinutes !== null && point.settledGames > 0);
  const settledGames = settled.reduce((total, point) => total + point.settledGames, 0);
  const averageLatency = settledGames ? Math.round(settled.reduce((total, point) => total + point.latencyMinutes! * point.settledGames, 0) / settledGames) : null;

  return <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Provider cost and settlement by kickoff slate">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-400">Score polling · Season to date</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">Provider cost &amp; settlement</h3>
        <p className="mt-2 text-xs text-zinc-500">One point per game-time slate · Eastern time</p>
      </div>
      <div className="flex rounded-lg bg-zinc-100 p-1">{(["all", "14"] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${range === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>{value === "all" ? "All slates" : "Last 14"}</button>)}</div>
    </div>
    <div className="provider-efficiency-summary provider-performance-summary" aria-label="Provider cost and settlement summary">
      <div><span>Score credits</span><strong>{number(summary.scoreCredits)}</strong><small>Season-to-date polling</small></div>
      <div><span>Credits / game</span><strong>{number(creditsPerGame)}</strong><small>{attributedGames} games in attributed slates</small></div>
      <div><span>Settlement average</span><strong>{averageLatency === null ? "-" : `${averageLatency}m`}</strong><small>{settledGames} settled games</small></div>
    </div>
    <ProviderChart
      key={range}
      label="Credits per settled game and minutes to accepted final by kickoff slate"
      yAxisLabel="Credits / game"
      rightAxis={{ label: "Minutes to final", suffix: "m", scale: "tight" }}
      points={observed.map((point, index) => ({
        label: `${date(point.slateStartedAt, true)} ET · ${point.games} game${point.games === 1 ? "" : "s"}`,
        shortLabel: date(point.slateStartedAt),
        values: {
          credits: point.creditsPerGame,
          average15: rollingCreditsPerGame15Days(history, first + index),
          latency: point.latencyMinutes,
        },
        note: point.latencyMinutes === null ? "Slate is not fully settled yet."
          : point.attribution === "unavailable" ? "Polling attribution overlaps another slate; credits/game is withheld."
          : point.attribution === "no-data" ? "No attributable polling receipt for this slate."
          : `${point.settledGames} settled games · ${point.calls} score checks · polling credits attributed by run time`,
      }))}
      series={[
        { key: "credits", label: "Credits / game", color: "#4f46e5" },
        { key: "average15", label: "15-day avg · credits/game", color: "#a855f7", dash: "5 4" },
        { key: "latency", label: "Settlement latency", color: "#059669", axis: "right", suffix: "m" },
      ]}
    />
    <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Left axis: score-polling credits per settled game. Right axis: average minutes from the pooled kickoff to accepted final. The 15-day line is a game-weighted average over the current and previous 14 Eastern calendar dates; slates with missing or ambiguous credits are excluded. Credit attribution is estimated from polling times.</p>
    <details className="mt-5 border-t border-zinc-200 pt-4">
      <summary className="w-fit cursor-pointer text-xs font-bold text-indigo-700">Game and period latency details</summary>
      <LatencyViewsPanel metric={latencyMetric} embedded />
    </details>
  </section>;
}
