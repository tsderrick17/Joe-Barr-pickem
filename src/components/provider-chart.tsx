"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ChartPoint = { label: string; shortLabel: string; values: Record<string, number | null>; start?: number; end?: number; note?: string };
export type ChartSeries = { key: string; label: string; color: string; axis?: "right"; kind?: "bar" | "area"; suffix?: string };
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
function scaleMax(value: number) {
  if (value <= 0) return 4;
  const unit = 10 ** Math.floor(Math.log10(value / 4));
  const step = [1, 2, 5, 10].find((step) => step * unit >= value / 4)! * unit;
  return step * 4;
}

export default function ProviderChart({ points, series, label, histogram = false }: {
  points: ChartPoint[]; series: ChartSeries[]; label: string; histogram?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [selected, setSelected] = useState<number | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const gradient = useId().replaceAll(":", "");
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const activeSeries = series.filter((item) => !hidden.includes(item.key));
  const right = series.some((item) => item.axis === "right");
  const left = 46, edge = right ? 46 : 16, top = 22, bottom = 234;
  const plotWidth = width - left - edge, height = bottom - top;
  const highest = Math.max(0, ...points.flatMap((point) => activeSeries.filter((item) => !item.axis).map((item) => point.values[item.key] ?? 0)));
  const maximum = histogram ? Math.max(4, Math.ceil(highest / 4) * 4) : scaleMax(highest);
  const domain = Math.max(1, ...points.map((point) => point.end ?? 0));
  const x = (index: number) => histogram
    ? left + (((points[index].start ?? 0) + (points[index].end ?? 0)) / 2 / domain) * plotWidth
    : left + (points.length === 1 ? plotWidth / 2 : index * plotWidth / Math.max(1, points.length - 1));
  const y = (value: number, item: ChartSeries) => bottom - value / (item.axis ? 100 : maximum) * height;
  const index = Math.min(selected ?? Math.max(0, points.length - 1), Math.max(0, points.length - 1));
  const point = points[index];
  const tickCount = width < 500 ? 2 : 5;
  const ticks = [...new Set(Array.from({ length: Math.min(tickCount, points.length) }, (_, i) => Math.round(i * (points.length - 1) / Math.max(1, Math.min(tickCount, points.length) - 1))))];
  function inspect(clientX: number) {
    const bounds = container.current?.getBoundingClientRect();
    if (!bounds || !points.length) return;
    const position = Math.max(0, Math.min(1, (clientX - bounds.left - left) / plotWidth));
    setSelected(histogram ? Math.max(0, points.findIndex((entry) => position * domain <= (entry.end ?? 0))) : Math.round(position * (points.length - 1)));
  }
  return <div ref={container} className="min-w-0">
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
      {series.map((item) => <button key={item.key} type="button" aria-pressed={!hidden.includes(item.key)}
        className="inline-flex items-center gap-2 rounded px-1 py-1 text-xs font-semibold text-zinc-600 outline-offset-4 focus-visible:outline-2 focus-visible:outline-indigo-600"
        onClick={() => setHidden((current) => current.includes(item.key) ? current.filter((key) => key !== item.key) : current.length < series.length - 1 ? [...current, item.key] : current)}>
        <span className="h-2 w-5 rounded-full" style={{ background: hidden.includes(item.key) ? "#d4d4d8" : item.color }} />
        {item.label}{item.axis ? " · right axis" : series.some((entry) => entry.axis) ? " · left axis" : ""}
      </button>)}
    </div>
    <div className="min-h-20 rounded-lg border border-zinc-100 bg-zinc-50/70 px-4 py-3">
      <p className="text-xs font-medium text-zinc-500">{point?.label ?? "No observations yet"}</p>
      <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">{activeSeries.map((item) => <p key={item.key} className="text-xs text-zinc-500">
        <strong className="mr-1.5 text-lg font-semibold tabular-nums" style={{ color: item.color }}>{point?.values[item.key] == null ? "—" : number(point.values[item.key]!)}{point?.values[item.key] == null ? "" : item.suffix}</strong>{item.label}
      </p>)}</div>
      {point?.note ? <p className="mt-1 text-xs text-zinc-500">{point.note}</p> : null}
    </div>
    {points.length ? <>
      <svg className="mt-3 block w-full touch-pan-y" style={{ height: 286 }} viewBox={`0 0 ${width} 286`}
        role="img" aria-label={label} onPointerMove={(event) => inspect(event.clientX)} onPointerDown={(event) => inspect(event.clientX)}>
        <defs>{series.map((item) => <linearGradient id={`${gradient}-${item.key}`} key={item.key} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={item.color} stopOpacity=".17" /><stop offset="100%" stopColor={item.color} stopOpacity=".015" />
        </linearGradient>)}</defs>
        {[0, .25, .5, .75, 1].map((fraction) => <g key={fraction}>
          <line x1={left} x2={width - edge} y1={bottom - fraction * height} y2={bottom - fraction * height} stroke="#e9eaef" strokeDasharray={fraction ? "3 4" : undefined} />
          <text x={left - 9} y={bottom - fraction * height + 4} textAnchor="end" fill="#71717a" fontSize="10">{number(maximum * fraction)}</text>
          {right ? <text x={width - edge + 8} y={bottom - fraction * height + 4} fill="#047857" fontSize="10">{fraction * 100}%</text> : null}
        </g>)}
        {activeSeries.map((item) => {
          if (item.kind === "bar") return <g key={item.key}>{points.map((entry, i) => {
            const barWidth = histogram ? ((entry.end ?? 0) - (entry.start ?? 0)) / domain * plotWidth : Math.max(2, plotWidth / Math.max(1, points.length) * .7);
            const barX = histogram ? left + (entry.start ?? 0) / domain * plotWidth : Math.min(width - edge - barWidth, Math.max(left, x(i) - barWidth / 2));
            const value = entry.values[item.key];
            return value == null ? null : <rect key={i} x={barX} y={y(value, item)} width={barWidth} height={bottom - y(value, item)}
              fill={item.color} fillOpacity={selected === null || index === i ? .85 : .35} stroke="white" strokeWidth={histogram ? 1 : 0} />;
          })}</g>;
          const segments: string[] = [];
          let segment = "";
          points.forEach((entry, i) => {
            const value = entry.values[item.key];
            if (value === null || value === undefined) { if (segment) segments.push(segment); segment = ""; }
            else segment += `${segment ? " L" : "M"}${x(i)},${y(value, item)}`;
          });
          if (segment) segments.push(segment);
          return <g key={item.key}>
            {item.kind === "area" && segments.length === 1 && points.every((entry) => entry.values[item.key] != null) ? <path d={`${segments[0]} L${x(points.length - 1)},${bottom} L${x(0)},${bottom} Z`} fill={`url(#${gradient}-${item.key})`} /> : null}
            {segments.map((path, i) => <path key={i} d={path} fill="none" stroke={item.color} strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />)}
            {points.map((entry, i) => entry.values[item.key] == null ? null : <circle key={i} cx={x(i)} cy={y(entry.values[item.key]!, item)} r={index === i ? 4 : 2.5} fill={item.color} stroke="white" strokeWidth="1.5" />)}
          </g>;
        })}
        {point ? <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="#a1a1aa" strokeDasharray="3 4" pointerEvents="none" /> : null}
        {histogram ? [0, domain / 3, domain * 2 / 3, domain].map((value) => <text key={value} x={left + value / domain * plotWidth} y="259" textAnchor={value === 0 ? "start" : value === domain ? "end" : "middle"} fill="#71717a" fontSize="10">{Math.round(value)}m</text>)
          : ticks.map((i) => <text key={i} x={x(i)} y="257" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fill="#71717a" fontSize="10">
            {points[i].shortLabel.split(", ").map((part, row) => <tspan key={row} x={x(i)} dy={row ? 13 : 0}>{part}</tspan>)}
          </text>)}
      </svg>
      <div className="flex items-center gap-3 border-t border-zinc-100 pt-3">
        <span className="shrink-0 text-[11px] text-zinc-500">Explore</span>
        <input aria-label={`Explore ${label}`} type="range" min="0" max={Math.max(0, points.length - 1)} value={index}
          onChange={(event) => setSelected(Number(event.target.value))} className="min-w-0 flex-1 accent-indigo-600" />
        <span className="text-[11px] tabular-nums text-zinc-400">{index + 1} / {points.length}</span>
      </div>
    </> : <p className="py-14 text-center text-sm text-zinc-500">Recorded activity will appear here as it arrives.</p>}
    <details className="mt-3 text-xs text-zinc-500"><summary className="w-fit cursor-pointer py-1 font-medium">View chart data</summary>
      <div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Interval</th>{series.map((item) => <th className="p-2" key={item.key}>{item.label}</th>)}</tr></thead><tbody>
        {points.map((entry, i) => <tr className="border-t border-zinc-100" key={i}><td className="p-2">{entry.label}</td>{series.map((item) => <td className="p-2 tabular-nums" key={item.key}>{entry.values[item.key] == null ? "—" : number(entry.values[item.key]!)}{entry.values[item.key] == null ? "" : item.suffix}</td>)}</tr>)}
      </tbody></table></div>
    </details>
  </div>;
}
