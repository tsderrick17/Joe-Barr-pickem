"use client";

import ProviderChart from "@/components/provider-chart";
import { ladderChartData } from "@/lib/ladder-chart.js";

export type PollingLadderItem = { rung: number; windowMinutes: number; newFinals: number; pickedUp: number; percentage: number; newFinalsPercentage: number };

export function LadderHistogram({ items }: { items: PollingLadderItem[] }) {
  const { points, emergencyFinals, emergencyMinutes } = ladderChartData(items);
  return <>
    <ProviderChart histogram percentYAxis points={points} label="Histogram of the share of new fresh final scores found in each polling window"
      series={[{ key: "finals", label: "of all fresh finals", kind: "bar", color: "#4f46e5", suffix: "%" }]} />
    {emergencyMinutes.length ? <p className="mt-2 text-xs text-(color:--themed-text-27)">
      Emergency windows ({emergencyMinutes.length > 1 ? `${emergencyMinutes.slice(0, -1).join(", ")} and ${emergencyMinutes.at(-1)}` : emergencyMinutes[0]}-minute gaps, not charted): <strong className="font-bold tabular-nums">{emergencyFinals}</strong> fresh final{emergencyFinals === 1 ? "" : "s"} all time
    </p> : null}
  </>;
}
