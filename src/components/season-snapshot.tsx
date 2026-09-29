"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { snapshotRibbons, snapshotRibbonPath, snapshotStackOrder, snapshotX } from "@/lib/season-snapshot-chart.js";

type Player = { id: string; firstName: string; wins: number };
type Week = { id: string; label: string; complete: boolean; scores: Array<{ playerId: string; wins: number }> };
type Snapshot = { regular: Week[]; playoffs: Week[] };

// Eleven hues in a fixed order, assigned alphabetically so each person keeps
// their color no matter who is hidden. Checked with the dataviz palette
// validator on the chart's cream surface: lightness band, chroma floor, and
// adjacent color-blind and normal-vision separation all pass. Contrast against
// the paper is under 3:1 for a few hues, so identity never depends on color
// alone: every line has a named key entry and hover highlights one player.
const palette = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300",
  "#4a3aa7", "#e34948", "#00a3c4", "#b13fd0", "#8ab800",
];

function shortWeek(label: string) {
  const regular = label.match(/week\s*(\d+)/i);
  if (regular) return regular[1];
  return label.replace(/\b(round|playoff|championships?)\b/gi, "").trim().slice(0, 8).toUpperCase() || label.slice(0, 8);
}

function SnapshotChart({
  title, showTitle, weeks, players, colors, baseline, hoverId, onHover, isPlayoff,
}: {
  title: string;
  showTitle: boolean;
  weeks: Week[];
  players: Player[];
  colors: Map<string, string>;
  baseline: Record<string, number>;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  isPlayoff: boolean;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      setWidth((current) => current === nextWidth ? current : nextWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Only the players still on the chart shape the axis, so hiding the leader
  // rescales the chart to the people who remain.
  const shownIds = new Set(players.map((player) => player.id));
  const values = [...players.map((player) => baseline[player.id] ?? 0), ...weeks.flatMap((week) => week.scores.filter((score) => shownIds.has(score.playerId)).map((score) => score.wins))];
  const observedValues = values.length ? values : [0];
  const low = isPlayoff ? Math.max(0, Math.floor((Math.min(...observedValues) - 1) / 2) * 2) : 0;
  const high = Math.max(low + 2, ...observedValues) + 1;
  const tickStep = Math.max(1, Math.ceil((high - low) / 5));
  const ceiling = low + Math.ceil((high - low) / tickStep) * tickStep;
  const height = 300;
  const left = 44;
  const right = 18;
  const top = 16;
  const bottom = 34;
  const plotHeight = height - top - bottom;
  const x = (weekIndex: number) => snapshotX(weekIndex, weeks.length, width);
  const y = (wins: number) => top + plotHeight * (1 - (wins - low) / (ceiling - low));
  // Lines that share a path stack by who held the greater total most recently.
  // Painting runs bottom lane first so the line that was ahead most recently is on top.
  const stacked = snapshotStackOrder(weeks, players, baseline);
  const rank = new Map(stacked.map((player, index) => [player.id, index]));
  const ribbons = snapshotRibbons(weeks, stacked, baseline, x, y)
    .sort((a, b) => (rank.get(b.playerId) ?? 0) - (rank.get(a.playerId) ?? 0));

  return <section className="season-snapshot-chart">
    {showTitle ? <h4 className="season-snapshot-chart-title">{title}</h4> : null}
    <div aria-label={`${title}: cumulative wins by week`} className="season-snapshot-plot-scroll" ref={plotRef} role="group">
      <svg aria-label={`${title}, cumulative wins by week`} height={height} role="img" viewBox={`0 0 ${width} ${height}`} width={width}>
        {Array.from({ length: (ceiling - low) / tickStep + 1 }, (_, index) => low + index * tickStep).map((tick) => <g key={tick}>
          <line stroke="#d9d2c3" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
          <text fill="#536077" fontFamily="Arial, sans-serif" fontSize="11" textAnchor="end" x={left - 7} y={y(tick) + 4}>{tick}</text>
        </g>)}
        {weeks.map((week, index) => <g key={week.id}>
          <line stroke="#e8e0d1" strokeDasharray="2 4" x1={x(index + 1)} x2={x(index + 1)} y1={top} y2={height - bottom} />
          <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor={index === weeks.length - 1 ? "end" : "middle"} x={x(index + 1)} y={height - 12}>{shortWeek(week.label)}</text>
        </g>)}
        <g className="season-snapshot-lines">
          {ribbons.map((ribbon) => <g className={`season-snapshot-ribbon ${hoverId && hoverId !== ribbon.playerId ? "is-dim" : ""}`} key={`${ribbon.weekIndex}:${ribbon.playerId}`} onMouseEnter={() => onHover(ribbon.playerId)} onMouseLeave={() => onHover(null)}>
            <path d={snapshotRibbonPath(ribbon.points)} fill={colors.get(ribbon.playerId)} />
            <path d={snapshotRibbonPath(ribbon.points, 0, 0.22)} fill="white" fillOpacity="0.32" />
            <path d={snapshotRibbonPath(ribbon.points, 0.78, 1)} fill="#102030" fillOpacity="0.3" />
          </g>)}
        </g>
      </svg>
    </div>
  </section>;
}

/** The chart and its player key. Kept separate from loading so it renders from plain data. */
export function SnapshotView({ standings, snapshot, isPlayoff }: { standings: Player[]; snapshot: Snapshot; isPlayoff: boolean }) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Colors follow the person, never their rank or who is visible.
  const alphabetical = [...standings].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const colors = new Map(alphabetical.map((player, index) => [player.id, palette[index % palette.length]]));
  const visible = standings.filter((player) => !hidden.has(player.id));
  const toggle = (id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setHoverId(null);
  };
  const lastRegular = snapshot.regular.at(-1);
  const playoffBaseline = Object.fromEntries((lastRegular?.scores ?? []).map((score) => [score.playerId, score.wins]));
  const showPlayoffs = isPlayoff || snapshot.playoffs.length > 0;
  // A chart title is only needed to tell two charts apart.
  const showTitles = showPlayoffs;

  return <div className="season-snapshot-layout">
    <div className="season-snapshot-charts">
      <SnapshotChart baseline={{}} colors={colors} hoverId={hoverId} isPlayoff={false} onHover={setHoverId} players={visible} showTitle={showTitles} title="Regular season" weeks={snapshot.regular} />
      {showPlayoffs ? <SnapshotChart baseline={playoffBaseline} colors={colors} hoverId={hoverId} isPlayoff onHover={setHoverId} players={visible} showTitle={showTitles} title="Playoffs" weeks={snapshot.playoffs} /> : null}
    </div>
    <div aria-label="Players shown on the chart" className="season-snapshot-key">
      {standings.map((player) => {
        const shown = !hidden.has(player.id);
        return <button aria-label={`${player.firstName}, ${player.wins} wins. ${shown ? "Shown; press to hide" : "Hidden; press to show"}`} aria-pressed={shown} className={`season-snapshot-key-row ${shown ? "" : "is-hidden"}`} key={player.id} onBlur={() => setHoverId(null)} onClick={() => toggle(player.id)} onFocus={() => shown && setHoverId(player.id)} onMouseEnter={() => shown && setHoverId(player.id)} onMouseLeave={() => setHoverId(null)} type="button">
          <span aria-hidden="true" className="season-snapshot-swatch" style={{ backgroundColor: colors.get(player.id) }} />
          <span className="season-snapshot-key-name">{player.firstName}</span><strong>{player.wins}</strong>
        </button>;
      })}
      {hidden.size ? <button className="season-snapshot-show-all" onClick={() => { setHidden(new Set()); setHoverId(null); }} type="button">Show all</button> : null}
    </div>
  </div>;
}

export default function SeasonSnapshot({ standings, refreshKey, isPlayoff }: { standings: Player[]; refreshKey: string; isPlayoff: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const fetchSnapshot = useCallback(async () => {
    const response = await fetchWithSession("/api/admin/season-snapshot");
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Season Snapshot could not be loaded.");
    return { regular: payload.regular ?? [], playoffs: payload.playoffs ?? [] };
  }, []);

  // The normal home refresh already detects new grades; no extra polling loop.
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    void fetchSnapshot().then((data) => {
      if (cancelled) return;
      setSnapshot(data);
      setError("");
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Season Snapshot could not be loaded.");
    });
    return () => { cancelled = true; };
  }, [expanded, refreshKey, retry, fetchSnapshot]);

  return <div className={`season-snapshot ${expanded ? "is-expanded" : ""}`}>
    <div className="season-snapshot-heading">
      <h3>Season Snapshot</h3>
      <button aria-expanded={expanded} aria-label={expanded ? "Minimize Season Snapshot" : "Expand Season Snapshot"} className="survivor-title-toggle" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "−" : "+"}</button>
    </div>
    {expanded ? <div className="season-snapshot-body">
      {error ? <div className="season-snapshot-message" role="alert">{error} <button className="underline" onClick={() => setRetry((current) => current + 1)} type="button">Retry</button></div> : !snapshot ? <p className="season-snapshot-message">Loading scores…</p> : <SnapshotView isPlayoff={isPlayoff} snapshot={snapshot} standings={standings} />}
    </div> : null}
  </div>;
}
