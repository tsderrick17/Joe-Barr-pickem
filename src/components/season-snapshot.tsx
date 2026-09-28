"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { snapshotLayers, snapshotX } from "@/lib/season-snapshot-chart.js";

type Player = { id: string; firstName: string; wins: number };
type Week = { id: string; label: string; complete: boolean; scores: Array<{ playerId: string; wins: number }> };
type Snapshot = { regular: Week[]; playoffs: Week[] };
type Inspection = { playerId: string; label: string; wins: number };

// Stable alphabetical assignment; standings changes never swap a player's color.
const palette = [
  "#0066e6", "#e45400", "#008f85", "#a03dd5", "#d52578", "#298d27",
  "#d52d2d", "#007da9", "#ad7600", "#4c4acb", "#667d00",
];

function shortWeek(label: string) {
  const regular = label.match(/week\s*(\d+)/i);
  if (regular) return `W${regular[1]}`;
  return label.replace(/\b(round|playoff|championships?)\b/gi, "").trim().slice(0, 8).toUpperCase() || label.slice(0, 8);
}

function SnapshotChart({
  title, weeks, standings, colors, baseline, focusedId, onInspect, isPlayoff,
}: {
  title: string;
  weeks: Week[];
  standings: Player[];
  colors: Map<string, string>;
  baseline: Record<string, number>;
  focusedId: string | null;
  onInspect: (inspection: Inspection) => void;
  isPlayoff: boolean;
}) {
  const shownPlayers = focusedId ? standings.filter((player) => player.id === focusedId) : standings;
  const { segments, pointGroups } = snapshotLayers(weeks, shownPlayers, baseline);
  const values = [...shownPlayers.map((player) => baseline[player.id] ?? 0), ...weeks.flatMap((week) => week.scores.map((score) => score.wins))];
  const low = isPlayoff ? Math.max(0, Math.floor((Math.min(...values) - 1) / 2) * 2) : 0;
  const high = Math.max(low + 2, ...values) + 1;
  const tickStep = Math.max(1, Math.ceil((high - low) / 5));
  const ceiling = low + Math.ceil((high - low) / tickStep) * tickStep;
  const width = Math.max(450, snapshotX(weeks.length) + 36);
  const height = 340;
  const top = 17;
  const bottom = 48;
  const plotHeight = height - top - bottom;
  const y = (wins: number) => top + plotHeight * (1 - (wins - low) / (ceiling - low));
  const label = isPlayoff ? "End regular season" : "Start · 0 wins";

  return <section className="season-snapshot-chart">
    <h4 className="season-snapshot-chart-title">{title}</h4>
    <p className="season-snapshot-chart-note">{isPlayoff ? "Season totals continue into the playoffs." : "A player's new point appears when both weekly picks are graded."}</p>
    <div aria-label={`${title}: cumulative wins by week`} className="season-snapshot-plot-scroll" role="group">
      <svg aria-label={`${title}, cumulative wins by week`} height={height} role="img" width={width}>
        {Array.from({ length: (ceiling - low) / tickStep + 1 }, (_, index) => low + index * tickStep).map((tick) => <g key={tick}>
          <line stroke="#d9d2c3" x1="62" x2={width - 16} y1={y(tick)} y2={y(tick)} />
          <text fill="#536077" fontFamily="Arial, sans-serif" fontSize="11" textAnchor="end" x="53" y={y(tick) + 4}>{tick}</text>
        </g>)}
        <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" letterSpacing=".5" textAnchor="middle" transform={`translate(14 ${top + plotHeight / 2}) rotate(-90)`}>CUMULATIVE WINS</text>
        {[label, ...weeks.map((week) => shortWeek(week.label))].map((text, index) => <g key={index}>
          <line stroke="#e8e0d1" strokeDasharray="2 4" x1={snapshotX(index)} x2={snapshotX(index)} y1={top} y2={height - bottom} />
          <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle" x={snapshotX(index)} y={height - 25}>{index === 0 ? (isPlayoff ? "REG" : "START") : text}</text>
        </g>)}
        <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" letterSpacing=".5" textAnchor="middle" x={(62 + width - 16) / 2} y={height - 7}>WEEK</text>
        {segments.flatMap((segment, segmentIndex) => segment.playerIds.map((playerId: string, layerIndex: number) => <line
          key={`${segmentIndex}:${playerId}`}
          stroke={colors.get(playerId)}
          strokeLinecap="round"
          strokeWidth={2.4 + (segment.playerIds.length - layerIndex - 1) * 1.5}
          x1={snapshotX(segment.weekIndex)} x2={snapshotX(segment.weekIndex + 1)}
          y1={y(segment.from)} y2={y(segment.to)}
        />))}
        {pointGroups.flatMap((group, groupIndex) => group.playerIds.map((playerId: string, layerIndex: number) => {
          const player = standings.find((entry) => entry.id === playerId);
          const pointLabel = group.weekIndex === 0 ? label : weeks[group.weekIndex - 1].label;
          return <circle
            aria-label={`${player?.firstName ?? "Player"}, ${pointLabel}: ${group.wins} wins`}
            cx={snapshotX(group.weekIndex)} cy={y(group.wins)}
            fill="var(--snapshot-paper)" key={`${groupIndex}:${playerId}`}
            onClick={() => onInspect({ playerId, label: pointLabel, wins: group.wins })}
            onFocus={() => onInspect({ playerId, label: pointLabel, wins: group.wins })}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onInspect({ playerId, label: pointLabel, wins: group.wins }); } }}
            onMouseEnter={() => onInspect({ playerId, label: pointLabel, wins: group.wins })}
            pointerEvents="visibleStroke" r={3.5 + (group.playerIds.length - layerIndex - 1) * 1.7}
            role="button" stroke={colors.get(playerId)} strokeWidth="2" tabIndex={0}
          />;
        }))}
      </svg>
    </div>
    {weeks.length === 0 ? <p className="season-snapshot-message">The chart begins at the season baseline. Weekly points will appear as cards are graded.</p> : null}
  </section>;
}

export default function SeasonSnapshot({ standings, refreshKey, isPlayoff }: { standings: Player[]; refreshKey: string; isPlayoff: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Inspection | null>(null);

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
  const selectedPlayer = inspected ? standings.find((player) => player.id === inspected.playerId) : null;

  return <div className={`season-snapshot ${expanded ? "is-expanded" : ""}`}>
    <div className="season-snapshot-heading">
      <div><h3>Season Snapshot</h3><p>Commissioner-only · cumulative Pick’em wins by week</p></div>
      <button aria-expanded={expanded} aria-label={expanded ? "Minimize Season Snapshot" : "Expand Season Snapshot"} className="survivor-title-toggle" onClick={() => setExpanded((current) => !current)} type="button">{expanded ? "−" : "+"}</button>
    </div>
    {expanded ? <div className="season-snapshot-body">
      {error ? <div className="season-snapshot-message" role="alert">{error} <button className="underline" onClick={() => setRetry((current) => current + 1)} type="button">Retry</button></div> : !snapshot ? <p className="season-snapshot-message">Loading scores…</p> : <>
        <div className="season-snapshot-layout">
          <div className="season-snapshot-charts">
            <SnapshotChart baseline={{}} colors={colors} focusedId={focusedId} isPlayoff={false} onInspect={setInspected} standings={standings} title="Regular season" weeks={snapshot.regular} />
            {isPlayoff || snapshot.playoffs.length > 0 ? <SnapshotChart baseline={playoffBaseline} colors={colors} focusedId={focusedId} isPlayoff onInspect={setInspected} standings={standings} title="Playoffs" weeks={snapshot.playoffs} /> : null}
          </div>
          <div aria-label="Current standings and chart color key" className="season-snapshot-key">
            <p className="season-snapshot-key-title">CURRENT STANDINGS</p>
            {standings.map((player) => <button aria-pressed={focusedId === player.id} className={`season-snapshot-key-row ${focusedId && focusedId !== player.id ? "is-dimmed" : ""}`} key={player.id} onClick={() => setFocusedId(focusedId === player.id ? null : player.id)} type="button">
              <span aria-hidden="true" className="season-snapshot-swatch" style={{ backgroundColor: colors.get(player.id) }} />
              <span className="season-snapshot-key-name">{player.firstName}</span><strong>{player.wins}</strong>
            </button>)}
          </div>
        </div>
        <p aria-live="polite" className="season-snapshot-readout">{selectedPlayer && inspected ? `${selectedPlayer.firstName} · ${inspected.label}: ${inspected.wins} cumulative wins` : "Select a name to trace their line. Shared scores are concentric in current standings order."}</p>
        <details className="season-snapshot-data"><summary>Weekly totals</summary><div className="overflow-x-auto"><table><thead><tr><th>Player</th>{[...snapshot.regular, ...snapshot.playoffs].map((week) => <th key={week.id}>{shortWeek(week.label)}</th>)}</tr></thead><tbody>{standings.map((player) => <tr key={player.id}><th>{player.firstName}</th>{[...snapshot.regular, ...snapshot.playoffs].map((week) => <td key={week.id}>{week.scores.find((score) => score.playerId === player.id)?.wins ?? "—"}</td>)}</tr>)}</tbody></table></div></details>
      </>}
    </div> : null}
  </div>;
}
