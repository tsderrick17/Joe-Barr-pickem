"use client";

import { useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type Player = { id: string; firstName: string; wins: number };
type Week = { id: string; label: string; scores: Array<{ playerId: string; wins: number }> };

// Assigned alphabetically, so a player's color does not change when rank does.
const palette = [
  "#24548a", "#b54730", "#117e70", "#8054a1", "#a06916", "#bd487e",
  "#547b24", "#317da5", "#783e69", "#866d38", "#535d83",
];
const dashes = ["", "", "", "", "", "", "5 3", "5 3", "5 3", "2 3", "2 3"];

function shortWeek(label: string) {
  const regular = label.match(/week\s*(\d+)/i);
  if (regular) return `W${regular[1]}`;
  return label.replace(/\b(round|playoff|championships?)\b/gi, "").trim().slice(0, 6).toUpperCase() || label.slice(0, 6);
}

function marker(x: number, y: number, index: number, color: string) {
  const shape = index % 3;
  if (shape === 1) return <rect fill="var(--snapshot-paper)" height="7" stroke={color} strokeWidth="2" width="7" x={x - 3.5} y={y - 3.5} />;
  if (shape === 2) return <path d={`M${x} ${y - 4.5} L${x + 4.5} ${y} L${x} ${y + 4.5} L${x - 4.5} ${y} Z`} fill="var(--snapshot-paper)" stroke={color} strokeWidth="2" />;
  return <circle cx={x} cy={y} fill="var(--snapshot-paper)" r="3.5" stroke={color} strokeWidth="2" />;
}

export default function SeasonSnapshot({ standings }: { standings: Player[] }) {
  const [expanded, setExpanded] = useState(false);
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<{ playerId: string; week: string; wins: number } | null>(null);

  async function loadSnapshot() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetchWithSession("/api/admin/season-snapshot");
      const payload = await response.json() as { weeks?: Week[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Season Snapshot could not be loaded.");
      setWeeks(payload.weeks ?? []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Season Snapshot could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    setExpanded((current) => !current);
    // An opened snapshot is fresh each time, so a newly settled week appears
    // without background polling while the section is minimized.
    if (!expanded && !loading) void loadSnapshot();
  }

  const alphabetical = [...standings].sort((a, b) => a.firstName.localeCompare(b.firstName));
  const styleById = new Map(alphabetical.map((player, index) => [player.id, { color: palette[index % palette.length], index }]));
  const chartPlayers = focusedId
    ? [...alphabetical].sort((a, b) => Number(a.id === focusedId) - Number(b.id === focusedId))
    : alphabetical;
  const maxWins = Math.max(1, ...(weeks ?? []).flatMap((week) => week.scores.map((score) => score.wins)));
  const step = Math.max(1, Math.ceil(maxWins / 5));
  const ceiling = Math.ceil(maxWins / step) * step;
  const width = Math.max(320, 42 + (weeks?.length ?? 0) * 52 + 20);
  const height = 322;
  const top = 16;
  const bottom = 35;
  const plotHeight = height - top - bottom;
  const x = (index: number) => 36 + (index + 1) * 52;
  const y = (wins: number) => top + plotHeight * (1 - wins / ceiling);
  const selectedPlayer = inspected ? standings.find((player) => player.id === inspected.playerId) : null;

  return <div className={`season-snapshot ${expanded ? "is-expanded" : ""}`}>
    <div className="season-snapshot-heading">
      <div><h3>Season Snapshot</h3><p>Pick’em wins after each settled week</p></div>
      <button aria-expanded={expanded} aria-label={expanded ? "Minimize Season Snapshot" : "Expand Season Snapshot"} className="survivor-title-toggle" onClick={toggle} type="button">{expanded ? "−" : "+"}</button>
    </div>
    {expanded ? <div className="season-snapshot-body">
      {loading ? <p className="season-snapshot-message">Loading settled weeks…</p> : error ? <div className="season-snapshot-message" role="alert">{error} <button className="underline" onClick={() => void loadSnapshot()} type="button">Retry</button></div> : weeks?.length === 0 ? <p className="season-snapshot-message">The first point appears when Week 1 settles.</p> : weeks ? <>
        <div className="season-snapshot-layout">
          <div aria-label="Cumulative Pick’em wins by settled week" className="season-snapshot-plot-scroll" role="group">
            <svg aria-label={`${weeks.length} settled week${weeks.length === 1 ? "" : "s"} of cumulative Pick’em wins`} height={height} role="group" width={width}>
              {Array.from({ length: ceiling / step + 1 }, (_, index) => index * step).map((tick) => <g key={tick}><line stroke="#d9d2c3" strokeWidth="1" x1="36" x2={width - 12} y1={y(tick)} y2={y(tick)} /><text fill="#746c62" fontFamily="Arial, sans-serif" fontSize="10" textAnchor="end" x="29" y={y(tick) + 3}>{tick}</text></g>)}
              {weeks.map((week, index) => <g key={week.id}><line stroke="#e8e0d1" strokeDasharray="2 4" x1={x(index)} x2={x(index)} y1={top} y2={height - bottom} /><text fill="#555d6b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle" x={x(index)} y={height - 11}><title>{week.label}</title>{shortWeek(week.label)}</text></g>)}
              {chartPlayers.map((player) => {
                const style = styleById.get(player.id)!;
                const scores = weeks.map((week) => week.scores.find((score) => score.playerId === player.id)?.wins ?? 0);
                // Separate all eleven tied markers horizontally without
                // changing their exact vertical win total.
                const lane = (style.index - (alphabetical.length - 1) / 2) * 4;
                const points = scores.map((score, index) => [x(index) + lane, y(score)]);
                const dimmed = focusedId !== null && focusedId !== player.id;
                return <g key={player.id} opacity={dimmed ? .12 : 1}>
                  <polyline fill="none" points={points.map((point) => point.join(",")).join(" ")} stroke={style.color} strokeDasharray={dashes[style.index % dashes.length]} strokeLinecap="round" strokeLinejoin="round" strokeWidth={focusedId === player.id ? 3.2 : 1.8} />
                  {scores.map((score, index) => <g key={weeks[index].id} onClick={() => { setFocusedId(player.id); setInspected({ playerId: player.id, week: weeks[index].label, wins: score }); }} onFocus={() => setInspected({ playerId: player.id, week: weeks[index].label, wins: score })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFocusedId(player.id); setInspected({ playerId: player.id, week: weeks[index].label, wins: score }); } }} onMouseEnter={() => setInspected({ playerId: player.id, week: weeks[index].label, wins: score })} role="button" tabIndex={dimmed ? -1 : 0} aria-label={`${player.firstName}, ${weeks[index].label}: ${score} wins`}>{marker(x(index) + lane, y(score), style.index, style.color)}<circle cx={x(index) + lane} cy={y(score)} fill="transparent" r="9" /></g>)}
                </g>;
              })}
            </svg>
          </div>
          <div aria-label="Current standings and chart color key" className="season-snapshot-key">
            <p className="season-snapshot-key-title">CURRENT STANDINGS</p>
            {standings.map((player) => {
              const style = styleById.get(player.id)!;
              const dimmed = focusedId !== null && focusedId !== player.id;
              return <button aria-pressed={focusedId === player.id} className={`season-snapshot-key-row ${dimmed ? "is-dimmed" : ""}`} key={player.id} onClick={() => setFocusedId(focusedId === player.id ? null : player.id)} type="button"><span aria-hidden="true" className="season-snapshot-swatch" style={{ backgroundColor: style.color }} /><span className="season-snapshot-key-name">{player.firstName}</span><strong>{player.wins}</strong></button>;
            })}
          </div>
        </div>
        <p aria-live="polite" className="season-snapshot-readout">{selectedPlayer && inspected ? `${selectedPlayer.firstName} · ${inspected.week}: ${inspected.wins} wins` : "Choose a name to trace their season. Current standings may include this week's games."}</p>
        <details className="season-snapshot-data"><summary>Weekly totals</summary><div className="overflow-x-auto"><table><thead><tr><th>Player</th>{weeks.map((week) => <th key={week.id}>{shortWeek(week.label)}</th>)}</tr></thead><tbody>{standings.map((player) => <tr key={player.id}><th>{player.firstName}</th>{weeks.map((week) => <td key={week.id}>{week.scores.find((score) => score.playerId === player.id)?.wins ?? 0}</td>)}</tr>)}</tbody></table></div></details>
      </> : null}
    </div> : null}
  </div>;
}
