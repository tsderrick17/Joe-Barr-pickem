"use client";

import ProviderChart from "@/components/provider-chart";

export type PollingLadderItem = { rung: number; windowMinutes: number; newFinals: number; pickedUp: number; percentage: number; newFinalsPercentage: number };

export function LadderHistogram({ items }: { items: PollingLadderItem[] }) {
  const points = items.map((item, index) => {
    const start = items.slice(0, index).reduce((sum, previous) => sum + previous.windowMinutes, 0);
    return { label: `Window ${item.rung} · ${item.windowMinutes}-minute polling gap`, shortLabel: `#${item.rung}`,
      start, end: start + item.windowMinutes, values: { finals: item.newFinals },
      note: `${item.newFinalsPercentage}% of recorded fresh finals · ${start}–${start + item.windowMinutes} minutes along the retry ladder` };
  });
  return <ProviderChart histogram points={points} label="Histogram of new fresh final scores by polling interval"
    series={[{ key: "finals", label: "Fresh finals", kind: "bar", color: "#4f46e5" }]} />;
}
