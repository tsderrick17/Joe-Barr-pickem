"use client";

import { useState } from "react";
import ProviderChart from "@/components/provider-chart";
import { rollingCreditsPerGame15Days, rollingCreditsPerGame30Days } from "@/lib/provider-chart-data.js";
import { formatAdminNumber } from "@/lib/format-admin-number.js";
import type { EfficiencyPoint, EfficiencySummary } from "@/components/efficiency-trend-panel";

const date = (value: string, time = false) => new Date(value).toLocaleString("en-US", {
  timeZone: "America/New_York", month: "short", day: "numeric",
  ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
});
const number = (value: number | null | undefined) => formatAdminNumber(value, { maximumFractionDigits: 1 });

export default function SlatePerformancePanel({ history, summary }: {
  history: EfficiencyPoint[];
  summary: EfficiencySummary;
}) {
  const [range, setRange] = useState<"all" | "14">("all");
  const first = range === "14" ? Math.max(0, history.length - 14) : 0;
  const observed = history.slice(first);
  const attributed = history.filter((point) => point.creditsPerGame !== null && point.settledGames > 0);
  const attributedGames = attributed.reduce((total, point) => total + point.settledGames, 0);
  const creditsPerGame = attributedGames ? attributed.reduce((total, point) => total + point.credits, 0) / attributedGames : null;

  return <section className="min-w-0 rounded-2xl border border-zinc-200 bg-(color:--themed-bg-26) p-4 shadow-sm sm:p-6" aria-label="Provider cost: credits per game, 15- and 30-day averages">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-400">Score polling · Season to date</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-(color:--themed-text-31)">Provider cost</h3>
        <p className="mt-2 text-xs text-(color:--themed-text-27)">Credits spent per game, smoothed over 15 and 30 days · Eastern time</p>
      </div>
      <div className="flex rounded-lg bg-zinc-100 p-1">{(["all", "14"] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${range === value ? "bg-(color:--themed-bg-26) text-(color:--themed-text-31) shadow-sm" : "text-(color:--themed-text-27)"}`}>{value === "all" ? "All slates" : "Last 14"}</button>)}</div>
    </div>
    <div className="provider-efficiency-summary provider-performance-summary" aria-label="Provider cost summary">
      <div><span>Score credits</span><strong>{number(summary.scoreCredits)}</strong><small>Season-to-date polling</small></div>
      <div><span>Credits / game</span><strong>{number(creditsPerGame)}</strong><small>{attributedGames} games in attributed slates</small></div>
    </div>
    <ProviderChart
      key={range}
      label="Credits per game: 15-day and 30-day moving averages"
      yAxisLabel="Credits / game"
      points={observed.map((point, index) => ({
        label: `${date(point.slateStartedAt, true)} ET · ${point.games} game${point.games === 1 ? "" : "s"}`,
        shortLabel: date(point.slateStartedAt),
        values: {
          average15: rollingCreditsPerGame15Days(history, first + index),
          average30: rollingCreditsPerGame30Days(history, first + index),
        },
        note: point.attribution === "unavailable" ? "Polling attribution overlaps another slate; this slate is left out of the averages."
          : point.attribution === "no-data" ? "No attributable polling receipt for this slate; it is left out of the averages."
          : point.settledGames === 0 ? "Slate is not fully settled yet; it joins the averages once it is."
          : `${point.settledGames} settled games · ${point.calls} score checks · polling credits attributed by run time`,
      }))}
      series={[
        { key: "average15", label: "15-day average", color: "#4f46e5" },
        { key: "average30", label: "30-day average", color: "#d97706", dash: "6 5" },
      ]}
    />
    <p className="mt-3 text-[11px] leading-relaxed text-(color:--themed-text-27)">Credits spent on score checks per settled game. Each line averages the games in the last 15 or 30 Eastern calendar dates, so a big Sunday counts for more than a single Thursday game; slates whose credits cannot be attributed are left out. Credits are attributed to a slate by the time each check ran, so they are an estimate.</p>
  </section>;
}
