"use client";

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { snapshotRibbons, snapshotRibbonPath, snapshotStackOrder, snapshotX } from "@/lib/season-snapshot-chart.js";

type Player = { id: string; firstName: string; wins: number; eliminated?: boolean };
type Week = { id: string; label: string; complete: boolean; scores: Array<{ playerId: string; wins: number }> };
type Snapshot = { regular: Week[]; playoffs: Week[]; colorOrder?: string[] };
type Range = "all" | "six";

// Eleven validated hues (lightness, chroma, and color-blind separation pass on
// the cream surface). Their order was shuffled three times with a secure random
// source on 2026-09-29 and then frozen, so nobody's color is picked on purpose.
// Players take colors in the order they joined the pool and keep them for good.
// Contrast is under 3:1 for a few hues, so identity never depends on color
// alone: every line has a named key entry and hover highlights one player.
const palette = [
  "#1baf7a", "#2a78d6", "#eb6834", "#e34948", "#00a3c4", "#e87ba4",
  "#eda100", "#b13fd0", "#4a3aa7", "#8ab800", "#008300",
];

/** Permanent colors: join order first, then anyone the order does not list. */
export function snapshotColors(standings: Player[], colorOrder: string[] = []) {
  // Keep every listed id, including players who are no longer active, so the
  // slots of everyone after them never shift.
  const known = colorOrder;
  const extras = [...standings].filter((player) => !known.includes(player.id)).sort((a, b) => a.firstName.localeCompare(b.firstName)).map((player) => player.id);
  return new Map([...known, ...extras].map((id, index) => [id, palette[index % palette.length]]));
}

// Chart choices are remembered on this device. Storage can be unavailable
// (private browsing), in which case the defaults simply apply each time.
const RANGE_KEY = "pickem.seasonSnapshot.range";
const hiddenKey = (phase: "regular" | "playoffs") => `pickem.seasonSnapshot.hidden.${phase}`;
function readSetting(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function saveSetting(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* not remembered; defaults apply */ }
}

function shortWeek(label: string) {
  const regular = label.match(/week\s*(\d+)/i);
  if (regular) return regular[1];
  return label.replace(/\b(round|playoff|championships?)\b/gi, "").trim().slice(0, 8).toUpperCase() || label.slice(0, 8);
}

// Tight margins: the axis labels sit right against the plot.
const AXIS_WIDTH = 30;
const PLOT_LEFT = 6;
const PLOT_RIGHT = 14;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 18;
/** The "6 Wk" view shows exactly this many weeks and scrolls a week at a time. */
export const WINDOW_WEEKS = 6;

function SnapshotChart({
  title, showTitle, weeks, players, colors, baseline, hoverId, onHover, isPlayoff, windowed = false,
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
  windowed?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 700, height: 300 });
  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: Math.round(entry.contentRect.width), height: Math.max(100, Math.round(entry.contentRect.height)) };
      setSize((current) => current.width === next.width && current.height === next.height ? current : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { height } = size;
  const viewport = Math.max(120, size.width - AXIS_WIDTH);
  const weekCount = Math.max(1, weeks.length);
  const scrolls = windowed && weeks.length > WINDOW_WEEKS;
  // In the 6-week view every week keeps a sixth of the visible width and the
  // extra weeks extend to the left; otherwise the season fits the view.
  const step = (viewport - PLOT_LEFT - PLOT_RIGHT) / (scrolls ? WINDOW_WEEKS : weekCount);
  const plotWidth = scrolls ? PLOT_LEFT + step * weekCount + PLOT_RIGHT : viewport;

  // The 6-week view always opens on the most recent six weeks.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && scrolls) element.scrollLeft = element.scrollWidth;
  }, [scrolls, plotWidth, weeks.length]);

  // Only the players still on the chart shape the axis, so hiding the leader
  // rescales the chart to the people who remain.
  const shownIds = new Set(players.map((player) => player.id));
  const values = [...players.map((player) => baseline[player.id] ?? 0), ...weeks.flatMap((week) => week.scores.filter((score) => shownIds.has(score.playerId)).map((score) => score.wins))];
  const observedValues = values.length ? values : [0];
  const low = isPlayoff ? Math.max(0, Math.floor((Math.min(...observedValues) - 1) / 2) * 2) : 0;
  const high = Math.max(low + 2, ...observedValues) + 1;
  const tickStep = Math.max(1, Math.ceil((high - low) / 5));
  const ceiling = low + Math.ceil((high - low) / tickStep) * tickStep;
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const x = (weekIndex: number) => snapshotX(weekIndex, weekCount, plotWidth, PLOT_LEFT, PLOT_RIGHT);
  const y = (wins: number) => PLOT_TOP + plotHeight * (1 - (wins - low) / (ceiling - low));
  const ticks = Array.from({ length: (ceiling - low) / tickStep + 1 }, (_, index) => low + index * tickStep);
  // Lines that share a path stack by who held the greater total most recently.
  // Painting runs bottom lane first so the line that was ahead most recently is on top.
  const stacked = snapshotStackOrder(weeks, players, baseline);
  const rank = new Map(stacked.map((player, index) => [player.id, index]));
  const ribbons = snapshotRibbons(weeks, stacked, baseline, x, y)
    .sort((a, b) => (rank.get(b.playerId) ?? 0) - (rank.get(a.playerId) ?? 0));

  return <section className="season-snapshot-chart">
    {showTitle ? <h4 className="season-snapshot-chart-title">{title}</h4> : null}
    <div className="season-snapshot-row" ref={rowRef}>
      <svg aria-hidden="true" className="season-snapshot-yaxis" height={height} width={AXIS_WIDTH}>
        {ticks.map((tick) => <text fill="#536077" fontFamily="Arial, sans-serif" fontSize="11" key={tick} textAnchor="end" x={AXIS_WIDTH - 4} y={y(tick) + 4}>{tick}</text>)}
        <text className="season-snapshot-axis-label" textAnchor="middle" transform={`translate(8 ${PLOT_TOP + plotHeight / 2}) rotate(-90)`}>Wins</text>
      </svg>
      <div aria-label={`${title}: cumulative wins by week`} className={`season-snapshot-plot-scroll ${scrolls ? "is-windowed" : ""}`} ref={scrollRef} role="group" tabIndex={scrolls ? 0 : undefined}>
        <div className="season-snapshot-plot-track" style={{ width: plotWidth }}>
          {scrolls ? Array.from({ length: weeks.length - WINDOW_WEEKS + 1 }, (_, index) => <span aria-hidden="true" className="season-snapshot-snap" key={index} style={{ left: index * step }} />) : null}
          <svg aria-label={`${title}, cumulative wins by week`} height={height} role="img" viewBox={`0 0 ${plotWidth} ${height}`} width={plotWidth}>
            {ticks.map((tick) => <line key={tick} stroke="#d9d2c3" x1={0} x2={plotWidth - PLOT_RIGHT} y1={y(tick)} y2={y(tick)} />)}
            {weeks.map((week, index) => <g key={week.id}>
              <line stroke="#e8e0d1" strokeDasharray="2 4" x1={x(index + 1)} x2={x(index + 1)} y1={PLOT_TOP} y2={height - PLOT_BOTTOM} />
              <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor={index === weeks.length - 1 ? "end" : "middle"} x={x(index + 1)} y={height - 5}>{shortWeek(week.label)}</text>
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
      </div>
    </div>
    <p aria-hidden="true" className="season-snapshot-week-label">Week</p>
  </section>;
}

/** The chart and its player key. Kept separate from loading so it renders from plain data. */
export function SnapshotView({ standings, snapshot, isPlayoff, range = "all" }: { standings: Player[]; snapshot: Snapshot; isPlayoff: boolean; range?: Range }) {
  const showPlayoffs = isPlayoff || snapshot.playoffs.length > 0;
  const phase = showPlayoffs ? "playoffs" : "regular";
  // Last choice wins. With no saved choice, the playoff chart starts without
  // players who are out of the playoff race; press a name to bring one back.
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const saved = readSetting(hiddenKey(phase));
    if (saved) {
      try {
        const ids: unknown = JSON.parse(saved);
        if (Array.isArray(ids)) return new Set(ids.filter((id): id is string => typeof id === "string"));
      } catch { /* fall through to the default */ }
    }
    return new Set(showPlayoffs ? standings.filter((player) => player.eliminated).map((player) => player.id) : []);
  });
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Colors follow the person, never their rank or who is visible.
  const colors = snapshotColors(standings, snapshot.colorOrder);
  const visible = standings.filter((player) => !hidden.has(player.id));
  const chooseHidden = (next: Set<string>) => {
    setHidden(next);
    saveSetting(hiddenKey(phase), JSON.stringify([...next]));
    setHoverId(null);
  };
  const toggle = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    chooseHidden(next);
  };
  const lastRegular = snapshot.regular.at(-1);
  const playoffBaseline = Object.fromEntries((lastRegular?.scores ?? []).map((score) => [score.playerId, score.wins]));

  return <div className="season-snapshot-layout">
    <div className="season-snapshot-charts">
      {/* The playoff chart replaces the regular-season chart; it starts from each
          player's final regular-season total. */}
      {showPlayoffs
        ? <SnapshotChart baseline={playoffBaseline} colors={colors} hoverId={hoverId} isPlayoff onHover={setHoverId} players={visible} showTitle={false} title="Playoffs" weeks={snapshot.playoffs} />
        : <SnapshotChart baseline={{}} colors={colors} hoverId={hoverId} isPlayoff={false} onHover={setHoverId} players={visible} showTitle={false} title="Regular season" weeks={snapshot.regular} windowed={range === "six"} />}
    </div>
    <div aria-label="Players shown on the chart" className="season-snapshot-key">
      {standings.map((player) => {
        const shown = !hidden.has(player.id);
        return <button aria-label={`${player.firstName}, ${player.wins} wins. ${shown ? "Shown; press to hide" : "Hidden; press to show"}`} aria-pressed={shown} className={`season-snapshot-key-row ${shown ? "" : "is-hidden"}`} key={player.id} onBlur={() => setHoverId(null)} onClick={() => toggle(player.id)} onFocus={() => shown && setHoverId(player.id)} onMouseEnter={() => shown && setHoverId(player.id)} onMouseLeave={() => setHoverId(null)} type="button">
          <span aria-hidden="true" className="season-snapshot-swatch" style={{ backgroundColor: colors.get(player.id) }} />
          <span className="season-snapshot-key-name">{player.firstName}</span><strong>{player.wins}</strong>
        </button>;
      })}
      <button className="season-snapshot-show-all" disabled={hidden.size === 0} onClick={() => chooseHidden(new Set())} type="button">Show all</button>
    </div>
  </div>;
}

/** The back of the Pick'em Pad. Loads the first time it is turned over. */
export default function SeasonSnapshot({ standings, refreshKey, isPlayoff, active, flipButton }: { standings: Player[]; refreshKey: string; isPlayoff: boolean; active: boolean; flipButton: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [opened, setOpened] = useState(false);
  const [range, setRange] = useState<Range>("all");
  // The saved view is read when the pad is first turned over, never during the
  // first render, so the server and browser always agree on the markup.
  if (active && !opened) {
    setOpened(true);
    setRange(readSetting(RANGE_KEY) === "six" ? "six" : "all");
  }

  const fetchSnapshot = useCallback(async () => {
    const response = await fetchWithSession("/api/season-snapshot");
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Season Snapshot could not be loaded.");
    return { regular: payload.regular ?? [], playoffs: payload.playoffs ?? [], colorOrder: payload.colorOrder ?? [] };
  }, []);

  // The normal home refresh already detects new grades; no extra polling loop.
  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    void fetchSnapshot().then((data) => {
      if (cancelled) return;
      setSnapshot(data);
      setError("");
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Season Snapshot could not be loaded.");
    });
    return () => { cancelled = true; };
  }, [opened, refreshKey, retry, fetchSnapshot]);

  // The week-range toggle is for the regular season only.
  const showPlayoffs = isPlayoff || (snapshot?.playoffs.length ?? 0) > 0;
  const chooseRange = (next: Range) => {
    setRange(next);
    saveSetting(RANGE_KEY, next);
  };

  return <div className="season-snapshot">
    <div className="pickem-ledger-masthead">
      <h2>Season Snapshot</h2>
      {!showPlayoffs ? <div aria-label="Weeks shown" className="season-snapshot-range" role="group">
        <button aria-pressed={range === "all"} onClick={() => chooseRange("all")} type="button">All</button>
        <button aria-pressed={range === "six"} onClick={() => chooseRange("six")} type="button">6 Wk</button>
      </div> : null}
      {flipButton}
    </div>
    <div className="season-snapshot-body">
      {error ? <div className="season-snapshot-message" role="alert">{error} <button className="underline" onClick={() => setRetry((current) => current + 1)} type="button">Retry</button></div> : !snapshot ? <p className="season-snapshot-message">Loading scores…</p> : <SnapshotView isPlayoff={isPlayoff} key={showPlayoffs ? "playoffs" : "regular"} range={range} snapshot={snapshot} standings={standings} />}
    </div>
  </div>;
}
