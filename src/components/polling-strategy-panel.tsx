"use client";

import ProviderChart from "@/components/provider-chart";
import { ladderChartData } from "@/lib/ladder-chart.js";

export type PollingLadderItem = { rung: number; windowMinutes: number; newFinals: number; pickedUp: number; percentage: number; newFinalsPercentage: number };

export function LadderHistogram({ items }: { items: PollingLadderItem[] }) {
  const { points, ticks, laterFinals, laterMinutes, laterIncludesLastCheck } = ladderChartData(items);
  const gaps = laterMinutes.length > 1 ? `${laterMinutes.slice(0, -1).join(", ")} and ${laterMinutes.at(-1)}` : laterMinutes[0];
  return <>
    <ProviderChart histogram histogramTicks={ticks} histogramTickPrefix="+" percentYAxis points={points} label="Histogram of the share of new fresh final scores found in each polling window"
      series={[{ key: "finals", label: "of all fresh finals", kind: "bar", color: "var(--club-forest-2)", suffix: "%" }]} />
    {laterMinutes.length || laterIncludesLastCheck ? <p className="mt-2 text-xs text-(color:--themed-text-27)">
      Later windows ({laterMinutes.length ? `${gaps}-minute gaps${laterIncludesLastCheck ? " and the last check" : ""}` : "the last check"}, not charted): <strong className="font-bold tabular-nums">{laterFinals}</strong> fresh final{laterFinals === 1 ? "" : "s"} so far
    </p> : null}
  </>;
}
