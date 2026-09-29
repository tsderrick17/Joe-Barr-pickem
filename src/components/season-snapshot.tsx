"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { snapshotLayers, snapshotX } from "@/lib/season-snapshot-chart.js";

type Player = { id: string; firstName: string; wins: number };
type Week = { id: string; label: string; complete: boolean; scores: Array<{ playerId: string; wins: number }> };
type Snapshot = { regular: Week[]; playoffs: Week[] };

const palette = [
  "#0066e6", "#e45400", "#008f85", "#a03dd5", "#d52578", "#298d27",
  "#d52d2d", "#007da9", "#ad7600", "#4c4acb", "#667d00",
];

function shortWeek(label: string) {
  const regular = label.match(/week\s*(\d+)/i);
  if (regular) return regular[1];
  return label.replace(/\b(round|playoff|championships?)\b/gi, "").trim().slice(0, 8).toUpperCase() || label.slice(0, 8);
}

function SnapshotChart({
  title, weeks, standings, colors, baseline, focusedId, isPlayoff,
}: {
  title: string;
  weeks: Week[];
  standings: Player[];
  colors: Map<string, string>;
  baseline: Record<string, number>;
  focusedId: string | null;
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

  const shownPlayers = focusedId ? standings.filter((player) => player.id === focusedId) : standings;
  const { segments } = snapshotLayers(weeks, shownPlayers, baseline);
  const values = [...shownPlayers.map((player) => baseline[player.id] ?? 0), ...weeks.flatMap((week) => week.scores.map((score) => score.wins))];
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

  return <section className="season-snapshot-chart">
    <h4 className="season-snapshot-chart-title">{title}</h4>
    <p className="season-snapshot-chart-note">{isPlayoff ? "Season totals continue into the playoffs." : "Weekly totals appear when both picks are graded."}</p>
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
        {segments.flatMap((segment, segmentIndex) => segment.playerIds.map((playerId: string, layerIndex: number) => <line
          key={`${segmentIndex}:${playerId}`}
          stroke={colors.get(playerId)}
          strokeLinecap="round"
          strokeWidth={2 + (segment.playerIds.length - layerIndex - 1) * 0.6}
          x1={x(segment.weekIndex)} x2={x(segment.weekIndex + 1)}
          y1={y(segment.from)} y2={y(segment.to)}
        />))}
      </svg>
    </div>
  </section>;
}

export default function SeasonSnapshot({ standings, refreshKey, isPlayoff }: { standings: Player[]; refreshKey: string; isPlayoff: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);

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

  const alphabetical = [...standings].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const colors = new Map(alphabetical.map((player, index) => [player.id, palette[index % palette.length]]));
  const lastRegular = snapshot?.regular.at(-1);
  const playoffBaseline = Object.fromEntries((lastRegular?.scores ?? []).map((score) => [score.playerId, score.wins]));

  return <div className={`season-snapshot ${expanded ? "is-expanded" : ""}`}>
    <div className="season-snapshot-heading">
      <div><h3>Season Snapshot</h3><p>Commissioner-only · cumulative Pick’em wins by week</p></div>
      <button aria-expanded={expanded} aria-label={expanded ? "Minimize Season Snapshot" : "Expand Season Snapshot"} className="survivor-title-toggle" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "−" : "+"}</button>
    </div>
    {expanded ? <div className="season-snapshot-body">
      {error ? <div className="season-snapshot-message" role="alert">{error} <button className="underline" onClick={() => setRetry((current) => current + 1)} type="button">Retry</button></div> : !snapshot ? <p className="season-snapshot-message">Loading scores…</p> : <>
        <div className="season-snapshot-layout">
          <div className="season-snapshot-charts">
            <SnapshotChart baseline={{}} colors={colors} focusedId={focusedId} isPlayoff={false} standings={standings} title="Regular season" weeks={snapshot.regular} />
            {isPlayoff || snapshot.playoffs.length > 0 ? <SnapshotChart baseline={playoffBaseline} colors={colors} focusedId={focusedId} isPlayoff standings={standings} title="Playoffs" weeks={snapshot.playoffs} /> : null}
          </div>
          <div aria-label="Current standings and chart color key" className="season-snapshot-key">
            <p className="season-snapshot-key-title">CURRENT STANDINGS</p>
            {standings.map((player) => <button aria-pressed={focusedId === player.id} className={`season-snapshot-key-row ${focusedId && focusedId !== player.id ? "is-dimmed" : ""}`} key={player.id} onClick={() => setFocusedId(focusedId === player.id ? null : player.id)} type="button">
              <span aria-hidden="true" className="season-snapshot-swatch" style={{ backgroundColor: colors.get(player.id) }} />
              <span className="season-snapshot-key-name">{player.firstName}</span><strong>{player.wins}</strong>
            </button>)}
          </div>
        </div>
      </>}
    </div> : null}
  </div>;
}
