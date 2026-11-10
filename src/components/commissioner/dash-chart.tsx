"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  columnWidth, extent, histogramBars, linePath, nearestIndex, plotArea, roundedTop, sparkline, spreadLabels, stackParts, xScale, yScale,
} from "@/lib/dash-chart.js";

export type Tone = "s1" | "s2";
export type DashSeries = { key: string; label: string; tone: Tone; values: Array<number | null>; dash?: boolean; area?: boolean };
type Reference = { y: number; label: string };

const plain = (value: number) => (Math.abs(value) >= 100 ? Math.round(value).toLocaleString("en-US") : String(Number(value.toFixed(2))));

/** Keeps a chart drawn at its box's real width, so text and marks stay crisp at every screen size. */
function useWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.round(element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * One chart for the numbers pages: lines (with an optional soft area under one), stacked columns, or a histogram whose bars are as wide as their
 * time windows. One y-axis, a hairline grid, red reference lines for limits, a dotted Today line, labels only at the line ends or the column tops,
 * a legend whenever there are two series, and a crosshair with a read-out under the pointer or finger. A hidden table carries the same numbers.
 */
export function DashChart({
  label, kind = "line", x, xTicks, series, yMin = 0, yMax, yTicks, format = plain, refs = [], today, endLabels = false, capLabels = false,
  marks, markLabel, note, height = 200, bins, extraKey,
}: {
  label: string;
  kind?: "line" | "columns" | "histogram";
  x: string[];
  xTicks?: Array<{ index: number; text: string }>;
  series: DashSeries[];
  yMin?: number;
  yMax: number;
  yTicks: number[];
  format?: (value: number) => string;
  refs?: Reference[];
  today?: number;
  endLabels?: boolean;
  capLabels?: boolean;
  marks?: Array<number | null>;
  markLabel?: string;
  note?: (index: number) => string;
  height?: number;
  bins?: Array<{ start: number; end: number }>;
  extraKey?: ReactNode;
}) {
  const [box, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const columns = kind === "columns";
  const area = plotArea(width, height, { endLabels: endLabels && kind === "line", left: Math.max(30, 8 + Math.max(...yTicks.map((tick) => format(tick).length)) * 6.5) });
  const y = yScale(area, yMin, yMax);
  const count = x.length;
  const at = xScale(area, count, columns);
  type Bar = { x: number; width: number; top: number; height: number; centre: number };
  const bars: Bar[] = kind === "histogram" && bins ? histogramBars(bins.map((bin, index) => ({ ...bin, value: series[0].values[index] ?? 0 })), area, y) : [];
  const minuteX = (minutes: number) => {
    const origin = bins?.[0]?.start ?? 0, span = (bins?.at(-1)?.end ?? 1) - origin || 1;
    return area.left + ((minutes - origin) / span) * area.width;
  };
  const centre = (index: number) => (kind === "histogram" ? bars[index]?.centre ?? 0 : at(index));
  const faded = (index: number) => today !== undefined && index > today;

  const ends: Array<{ y: number; text: string }> = [];
  if (kind === "line" && endLabels) {
    series.forEach((line) => {
      const span = extent(line.values);
      if (span && span.last === count - 1) ends.push({ y: y(line.values[span.last] as number) + 4, text: format(line.values[span.last] as number) });
    });
  }
  const endY = spreadLabels(ends.map((end) => end.y));

  function point(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    if (kind === "histogram") {
      const index = bars.findIndex((bar) => px < bar.x + bar.width + 1);
      setHover(index < 0 ? bars.length - 1 : index);
    } else setHover(nearestIndex(px, area, count, columns));
  }

  const tip = hover === null ? null : (() => {
    const rows = series.filter((line) => line.values[hover] !== null && line.values[hover] !== undefined);
    const left = centre(hover);
    const flip = left + 200 > width;
    return <div className="dash-tip" style={{ left: flip ? undefined : left + 12, right: flip ? width - left + 12 : undefined, top: area.top }}>
      <b>{x[hover]}</b>
      {rows.map((line) => <span key={line.key}><i className={`is-${line.tone}`} />{line.label}<em>{format(line.values[hover] as number)}</em></span>)}
      {marks && marks[hover] !== null && marks[hover] !== undefined ? <span><i className="is-ink" />{markLabel}<em>{format(marks[hover] as number)}</em></span> : null}
      {note?.(hover) ? <small>{note(hover)}</small> : null}
    </div>;
  })();

  const keyed = series.length > 1 || extraKey || refs.length > 0;
  return <figure className="dash-chart">
    {keyed ? <div className="dash-key" aria-hidden="true">
      {series.map((line) => <span key={line.key}><i className={`${kind === "line" ? (line.dash ? "is-dash" : "is-line") : "is-block"} is-${line.tone}`} />{line.label}</span>)}
      {marks ? <span><i className="is-line is-ink" />{markLabel}</span> : null}
      {extraKey}
    </div> : null}
    <div className="dash-plot" ref={box} style={{ height }}>
      {width ? <svg aria-hidden="true" height={height} onPointerDown={point} onPointerLeave={() => setHover(null)} onPointerMove={point} viewBox={`0 0 ${width} ${height}`} width={width}>
        {yTicks.map((tick) => <g key={tick}>
          <line className="dash-grid" x1={area.left} x2={area.left + area.width} y1={y(tick)} y2={y(tick)} />
          <text className="dash-axis" textAnchor="end" x={area.left - 7} y={y(tick) + 4}>{format(tick)}</text>
        </g>)}
        {(xTicks ?? []).map((tick, order, all) => {
          const anchor = kind === "line" && order === 0 && tick.index === 0 ? "start" : kind === "line" && order === all.length - 1 && tick.index === count - 1 ? "end" : "middle";
          // A histogram's ticks are minutes along its own axis, not point numbers.
          const tx = kind === "histogram" ? minuteX(tick.index) : at(tick.index);
          const histogramAnchor = order === 0 && tick.index <= (bins?.[0]?.start ?? 0) ? "start" : order === all.length - 1 && tick.index >= (bins?.at(-1)?.end ?? 0) ? "end" : "middle";
          return <text className="dash-axis" key={`${tick.index}-${tick.text}`} textAnchor={kind === "histogram" ? histogramAnchor : anchor} x={tx} y={height - 5}>{tick.text}</text>;
        })}
        {today !== undefined ? <g>
          <line className="dash-today" x1={at(today)} x2={at(today)} y1={area.top} y2={area.top + area.height} />
          <text className="dash-axis" textAnchor="middle" x={at(today)} y={area.top - 6}>Today</text>
        </g> : null}
        {refs.map((ref) => <g key={ref.label}>
          <line className="dash-ref" x1={area.left} x2={area.left + area.width} y1={y(ref.y)} y2={y(ref.y)} />
          <text className="dash-ref-label" x={area.left + 4} y={y(ref.y) - 5}>{ref.label}</text>
        </g>)}
        {kind === "line" ? series.map((line) => {
          const span = extent(line.values);
          if (!span) return null;
          const path = linePath(line.values, at, y);
          const last = line.values[span.last] as number;
          return <g key={line.key}>
            {line.area ? <path className={`dash-area is-${line.tone}`} d={`${path}L${at(span.last)} ${y(yMin)}L${at(span.first)} ${y(yMin)}Z`} /> : null}
            <path className={`dash-line is-${line.tone} ${line.dash ? "is-dash" : ""}`} d={path} />
            <circle className={`dash-dot is-${line.tone}`} cx={at(span.last)} cy={y(last)} r={4.5} />
            {endLabels && span.last < count - 1 ? <text className="dash-value" textAnchor="end" x={at(span.last) - 8} y={y(last) - 9}>{format(last)}</text> : null}
          </g>;
        }) : null}
        {columns ? x.map((_, index) => {
          const width = columnWidth(area.width, count);
          const { parts, total } = stackParts(series.map((line) => line.values[index]), y, yMin);
          const left = at(index) - width / 2;
          return <g className={faded(index) ? "is-faded" : ""} key={index}>
            {parts.map((part) => part.last
              ? <path className={`dash-col is-${series[part.series].tone}`} d={roundedTop(left, part.top, width, part.height)} key={part.series} />
              : <rect className={`dash-col is-${series[part.series].tone}`} height={part.height} key={part.series} width={width} x={left} y={part.top} />)}
            {capLabels && total > 0 ? <text className="dash-value" textAnchor="middle" x={at(index)} y={y(Math.max(total, marks?.[index] ?? 0)) - 7}>{format(total)}</text> : null}
            {marks && marks[index] !== null && marks[index] !== undefined ? <line className="dash-mark" x1={left - 5} x2={left + width + 5} y1={y(marks[index] as number)} y2={y(marks[index] as number)} /> : null}
          </g>;
        }) : null}
        {kind === "histogram" ? bars.map((bar, index) => <g className={hover !== null && hover !== index ? "is-dim" : ""} key={index}>
          <path className={`dash-col is-${series[0].tone}`} d={roundedTop(bar.x, bar.top, bar.width, bar.height)} />
          {capLabels ? <text className="dash-value" textAnchor="middle" x={bar.centre} y={bar.top - 6}>{format(series[0].values[index] ?? 0)}</text> : null}
        </g>) : null}
        {ends.map((end, index) => <text className="dash-value" key={end.text + index} x={area.left + area.width + 9} y={endY[index]}>{end.text}</text>)}
        {hover !== null && kind !== "histogram" ? <line className="dash-cross" x1={centre(hover)} x2={centre(hover)} y1={area.top} y2={area.top + area.height} /> : null}
      </svg> : null}
      {tip}
    </div>
    <table className="sr-only">
      <caption>{label}</caption>
      <thead><tr><th scope="col">Point</th>{series.map((line) => <th key={line.key} scope="col">{line.label}</th>)}</tr></thead>
      <tbody>{x.map((name, index) => <tr key={index}><th scope="row">{name}</th>{series.map((line) => <td key={line.key}>{line.values[index] === null || line.values[index] === undefined ? "–" : format(line.values[index] as number)}</td>)}</tr>)}</tbody>
    </table>
  </figure>;
}

/** A tiny trend in a tile's corner: grey line, coloured last point. */
export function Sparkline({ values }: { values: Array<number | null> }) {
  const line = sparkline(values);
  if (!line) return null;
  return <svg aria-hidden="true" className="dash-spark" height={22} viewBox="0 0 64 22" width={64}>
    <path d={line.path} />
    <circle cx={line.end.x} cy={line.end.y} r={3} />
  </svg>;
}

/** A headline figure: what it is, the number, one line under it, and an optional trend or meter. */
export function Tile({ label, value, sub, children, trend }: { label: string; value: string; sub?: ReactNode; children?: ReactNode; trend?: ReactNode }) {
  return <div className="dash-tile">
    <span>{label}</span>
    <b className={value.length > 8 ? "is-long" : ""}>{value}</b>
    {sub ? <small>{sub}</small> : null}
    {children}
    {trend}
  </div>;
}

/** An arrow before a change. Green when the change is good, whichever way it points. */
export function Change({ up, good, children }: { up: boolean; good: boolean; children: ReactNode }) {
  return <><i aria-hidden="true" className={`dash-arrow ${up ? "is-up" : "is-down"} ${good ? "is-good" : "is-bad"}`} />{children}</>;
}

/** How full something is: a thin bar, and a tick where it is heading by month end. */
export function Meter({ share, pace, tone = "s1", label }: { share: number; pace?: number | null; tone?: Tone | "warn" | "bad"; label: string }) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value * 100));
  return <div aria-label={label} className={`dash-meter is-${tone}`} role="img">
    <u style={{ width: `${clamp(share)}%` }} />
    {pace !== null && pace !== undefined ? <s style={{ left: `${clamp(pace)}%` }} /> : null}
  </div>;
}

/** A small two- or three-way switch for a chart's view. */
export function ViewSwitch<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return <div aria-label={label} className="dash-switch" role="group">
    {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
  </div>;
}

/** A chart card's head: the title (and a short line when it is needed), a headline number or a switch on the right. */
export function CardHead({ title, line, right }: { title: string; line?: string; right?: ReactNode }) {
  return <div className="dash-head">
    <div><h3>{title}</h3>{line ? <p>{line}</p> : null}</div>
    {right}
  </div>;
}

/** The headline number at a card's top right. */
export function Big({ value, sub }: { value: string; sub: string }) {
  return <div className="dash-big"><b>{value}</b><small>{sub}</small></div>;
}
