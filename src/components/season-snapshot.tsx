"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { snapshotAxis, snapshotRibbons, snapshotRibbonPath, snapshotStackOrder, snapshotWindowAxis, snapshotWindowRange, snapshotWindowStep, snapshotX } from "@/lib/season-snapshot-chart.js";

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
const VIEW_KEY = "pickem.seasonSnapshot.view";
const hiddenKey = (phase: "regular" | "playoffs") => `pickem.seasonSnapshot.hidden.${phase}`;
function readSetting(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function saveSetting(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* not remembered; defaults apply */ }
}

// The last chart is kept on the device so turning the pad over shows it at once
// while the current one loads behind it. A saved copy is only a head start: it
// is replaced as soon as fresh data arrives, and ignored if it is malformed.
const SNAPSHOT_KEY = "pickem.seasonSnapshot.last";
function readSavedSnapshot(): Snapshot | null {
  const saved = readSetting(SNAPSHOT_KEY);
  if (!saved) return null;
  try {
    const value = JSON.parse(saved) as Partial<Snapshot>;
    if (Array.isArray(value.regular) && Array.isArray(value.playoffs)) {
      return { regular: value.regular, playoffs: value.playoffs, colorOrder: Array.isArray(value.colorOrder) ? value.colorOrder : [] };
    }
  } catch { /* ignore a damaged copy */ }
  return null;
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
const WINDOW_WEEKS = 6;

/**
 * Where the 6-week view sits in the season. The page draws it instead of the browser so it matches the pad and never lies
 * on top of the week numbers. A mouse drags the thumb or presses the track; a finger or trackpad scrolls the chart itself
 * and the thumb follows. The chart stays a focusable group, so the arrow keys scroll it too.
 */
function SnapshotRail({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const [thumb, setThumb] = useState({ left: 0, width: 1 });
  // While a drag is on, how far along the thumb the pointer took hold (0 to 1 of the track).
  const grab = useRef<number | null>(null);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => {
      const next = { left: element.scrollLeft / element.scrollWidth, width: element.clientWidth / element.scrollWidth };
      setThumb((current) => current.left === next.left && current.width === next.width ? current : next);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [scroller]);
  const along = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (event.clientX - box.left) / box.width;
  };
  const moveTo = (fraction: number) => {
    const element = scroller.current;
    if (element && grab.current !== null) element.scrollTo({ left: (fraction - grab.current) * element.scrollWidth });
  };
  const release = () => { grab.current = null; };
  return <div
    aria-hidden="true"
    className="season-snapshot-rail"
    onPointerCancel={release}
    onPointerDown={(event) => {
      const fraction = along(event);
      grab.current = fraction >= thumb.left && fraction <= thumb.left + thumb.width ? fraction - thumb.left : thumb.width / 2;
      event.currentTarget.setPointerCapture(event.pointerId);
      moveTo(fraction);
    }}
    onPointerMove={(event) => moveTo(along(event))}
    onPointerUp={release}
  >
    <div className="season-snapshot-rail-track">
      <span className="season-snapshot-rail-thumb" style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }} />
    </div>
  </div>;
}

type Axis = { low: number; ceiling: number; tickStep: number };
const axisTicks = ({ low, ceiling, tickStep }: Axis) => Array.from({ length: Math.round((ceiling - low) / tickStep) + 1 }, (_, index) => low + index * tickStep);
// A critically damped spring: the axis glides to each new range without overshoot, and a range that changes again
// mid-glide (a fast scroll) carries the motion on instead of restarting it. About a third of a second to settle.
const SPRING = 16;

/**
 * The wins axis as drawn: it follows the target range on a spring, so the lines and the numbers move together. The
 * numbers that leave the axis stay until the glide ends, fading out as they slide.
 */
function useSpringAxis(target: Axis) {
  const { low, ceiling, tickStep } = target;
  const [shown, setShown] = useState({ low, ceiling });
  const [leaving, setLeaving] = useState<number[]>([]);
  const motion = useRef({ low, ceiling, lowSpeed: 0, ceilingSpeed: 0 });
  const lastTicks = useRef(axisTicks(target));
  useEffect(() => {
    const ticks = axisTicks({ low, ceiling, tickStep });
    const gone = lastTicks.current.filter((tick) => !ticks.includes(tick));
    lastTicks.current = ticks;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let previous = 0;
    const advance = (now: number) => {
      const state = motion.current;
      if (!previous) setLeaving((current) => {
        const next = [...new Set([...current, ...gone])].filter((tick) => !ticks.includes(tick));
        return next.length || current.length ? next : current;
      });
      const seconds = previous ? Math.min(1 / 30, (now - previous) / 1000) : 0;
      previous = now;
      state.lowSpeed += (SPRING * SPRING * (low - state.low) - 2 * SPRING * state.lowSpeed) * seconds;
      state.ceilingSpeed += (SPRING * SPRING * (ceiling - state.ceiling) - 2 * SPRING * state.ceilingSpeed) * seconds;
      state.low += state.lowSpeed * seconds;
      state.ceiling += state.ceilingSpeed * seconds;
      const near = (ceiling - low) / 500;
      const settled = still || (Math.abs(low - state.low) < near && Math.abs(ceiling - state.ceiling) < near && Math.abs(state.lowSpeed) < near * 10 && Math.abs(state.ceilingSpeed) < near * 10);
      if (settled) {
        motion.current = { low, ceiling, lowSpeed: 0, ceilingSpeed: 0 };
        setShown({ low, ceiling });
        setLeaving((current) => current.length ? [] : current);
        return;
      }
      setShown({ low: state.low, ceiling: state.ceiling });
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [low, ceiling, tickStep]);
  return { ...shown, ticks: axisTicks(target), leaving };
}

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

  // The part of the timeline in view, in weeks from the baseline. Kept to a twentieth of a week, so scrolling redraws
  // only when the range could change. Until the first scroll it is the latest six weeks, where the view opens.
  const edgesAt = (left: number) => ({
    from: Math.round(((left - PLOT_LEFT) / step) * 20) / 20,
    to: Math.round(((left + viewport - PLOT_LEFT) / step) * 20) / 20,
  });
  const [scrolled, setScrolled] = useState<{ from: number; to: number } | null>(null);
  // Leaving the 6-week view forgets where it was: it always reopens on the latest weeks.
  const [wasScrolling, setWasScrolling] = useState(scrolls);
  if (wasScrolling !== scrolls) {
    setWasScrolling(scrolls);
    setScrolled(null);
  }
  const edges = scrolls ? (scrolled ?? edgesAt(plotWidth - viewport)) : { from: 0, to: weekCount };
  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const next = edgesAt(element.scrollLeft);
    setScrolled((current) => current && current.from === next.from && current.to === next.to ? current : next);
  };

  // Only the players still on the chart shape the axis, so hiding the leader rescales the chart to the people who
  // remain. In the 6-week view it also fits the weeks in view and follows them as the chart scrolls; the whole regular
  // season always counts from zero.
  const range = snapshotWindowRange(weeks, players, baseline, edges.from, edges.to);
  const target = scrolls
    ? snapshotWindowAxis(range.min, range.max, snapshotWindowStep(weeks, players, baseline, WINDOW_WEEKS))
    : snapshotAxis(range.min, range.max, !isPlayoff);
  const { low, ceiling, ticks, leaving } = useSpringAxis(target);
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const x = (weekIndex: number) => snapshotX(weekIndex, weekCount, plotWidth, PLOT_LEFT, PLOT_RIGHT);
  const y = (wins: number) => PLOT_TOP + plotHeight * (1 - (wins - low) / (ceiling - low));
  const drawnTicks = [...ticks.map((tick) => ({ tick, gone: false })), ...leaving.map((tick) => ({ tick, gone: true }))];
  const clip = useId().replaceAll(":", "");
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
        <clipPath id={`${clip}-axis`}><rect height={height - PLOT_BOTTOM + 6} width={AXIS_WIDTH} x={0} y={0} /></clipPath>
        <g clipPath={`url(#${clip}-axis)`}>
          {drawnTicks.map(({ tick, gone }) => <text className={`season-snapshot-tick${gone ? " is-leaving" : ""}`} fill="#536077" fontFamily="Arial, sans-serif" fontSize="11" key={tick} textAnchor="end" x={AXIS_WIDTH - 4} y={y(tick) + 4}>{tick}</text>)}
        </g>
        <text className="season-snapshot-axis-label" textAnchor="middle" transform={`translate(10 ${PLOT_TOP + plotHeight / 2}) rotate(-90)`}>Wins</text>
      </svg>
      <div aria-label={`${title}: cumulative wins by week`} className={`season-snapshot-plot-scroll ${scrolls ? "is-windowed" : ""}`} onScroll={scrolls ? onScroll : undefined} ref={scrollRef} role="group" tabIndex={scrolls ? 0 : undefined}>
        <div className="season-snapshot-plot-track" style={{ width: plotWidth }}>
          {scrolls ? Array.from({ length: weeks.length - WINDOW_WEEKS + 1 }, (_, index) => <span aria-hidden="true" className="season-snapshot-snap" key={index} style={{ left: index * step }} />) : null}
          <svg aria-label={`${title}, cumulative wins by week`} height={height} role="img" viewBox={`0 0 ${plotWidth} ${height}`} width={plotWidth}>
            {/* Grid and lines stay above the week numbers, even mid-glide. */}
            <clipPath id={`${clip}-plot`}><rect height={height - PLOT_BOTTOM + 2} width={plotWidth} x={0} y={0} /></clipPath>
            <g clipPath={`url(#${clip}-plot)`}>
              {drawnTicks.map(({ tick, gone }) => <line className={`season-snapshot-tick${gone ? " is-leaving" : ""}`} key={tick} stroke="#d9d2c3" x1={0} x2={plotWidth - PLOT_RIGHT} y1={y(tick)} y2={y(tick)} />)}
            </g>
            {weeks.map((week, index) => <g key={week.id}>
              <line stroke="#e8e0d1" strokeDasharray="2 4" x1={x(index + 1)} x2={x(index + 1)} y1={PLOT_TOP} y2={height - PLOT_BOTTOM} />
              <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor={index === weeks.length - 1 ? "end" : "middle"} x={x(index + 1)} y={height - 5}>{shortWeek(week.label)}</text>
            </g>)}
            <g className="season-snapshot-lines" clipPath={`url(#${clip}-plot)`}>
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
    {scrolls ? <SnapshotRail scroller={scrollRef} /> : null}
  </section>;
}

/** The chart and its player key. Kept separate from loading so it renders from plain data. */
function SnapshotView({ standings, snapshot, isPlayoff, range = "all", view }: { standings: Player[]; snapshot: Snapshot; isPlayoff: boolean; range?: Range; view?: "regular" | "playoffs" }) {
  // Once the playoffs begin the chart can show either half; before then, only the regular season.
  const showPlayoffs = view ? view === "playoffs" : isPlayoff || snapshot.playoffs.length > 0;
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
  // The key shows what the chart shows: each player's total at the chart's last
  // point, never the live standings. Standings move as games finish, the chart
  // moves once when the week settles, and the two must change together.
  const lastPoint = showPlayoffs ? (snapshot.playoffs.at(-1) ?? lastRegular) : lastRegular;
  const chartTotals = new Map((lastPoint?.scores ?? []).map((score) => [score.playerId, score.wins]));
  const keyRows = standings
    .map((player, order) => ({ player, order, total: chartTotals.get(player.id) ?? 0 }))
    .sort((a, b) => b.total - a.total || a.order - b.order);

  return <div className="season-snapshot-layout">
    <div className="season-snapshot-charts">
      {/* The playoff chart replaces the regular-season chart; it starts from each
          player's final regular-season total. */}
      {showPlayoffs
        ? <SnapshotChart baseline={playoffBaseline} colors={colors} hoverId={hoverId} isPlayoff onHover={setHoverId} players={visible} showTitle={false} title="Playoffs" weeks={snapshot.playoffs} />
        : <SnapshotChart baseline={{}} colors={colors} hoverId={hoverId} isPlayoff={false} onHover={setHoverId} players={visible} showTitle={false} title="Regular season" weeks={snapshot.regular} windowed={range === "six"} />}
    </div>
    <div aria-label="Players shown on the chart" className="season-snapshot-key">
      {keyRows.map(({ player, total }) => {
        const shown = !hidden.has(player.id);
        return <button aria-label={`${player.firstName}, ${total} wins. ${shown ? "Shown; press to hide" : "Hidden; press to show"}`} aria-pressed={shown} className={`season-snapshot-key-row ${shown ? "" : "is-hidden"}`} key={player.id} onBlur={() => setHoverId(null)} onClick={() => toggle(player.id)} onFocus={() => shown && setHoverId(player.id)} onMouseEnter={() => shown && setHoverId(player.id)} onMouseLeave={() => setHoverId(null)} type="button">
          <span aria-hidden="true" className="season-snapshot-swatch" style={{ backgroundColor: colors.get(player.id) }} />
          <span className="season-snapshot-key-name">{player.firstName}</span><strong>{total}</strong>
        </button>;
      })}
      <button className="season-snapshot-show-all" disabled={hidden.size === 0} onClick={() => chooseHidden(new Set())} type="button">Show all</button>
    </div>
  </div>;
}

/** The back of the Pick'em Pad. Loads the first time it is turned over. */
export default function SeasonSnapshot({ standings, refreshKey, isPlayoff, active }: { standings: Player[]; refreshKey: string; isPlayoff: boolean; active: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [opened, setOpened] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [view, setView] = useState<"regular" | "playoffs">("playoffs");
  // The saved view is read when the pad is first turned over, never during the
  // first render, so the server and browser always agree on the markup.
  if (active && !opened) {
    setOpened(true);
    setRange(readSetting(RANGE_KEY) === "six" ? "six" : "all");
    setView(readSetting(VIEW_KEY) === "regular" ? "regular" : "playoffs");
    const saved = readSavedSnapshot();
    if (saved) setSnapshot(saved);
  }

  const fetchSnapshot = useCallback(async () => {
    const response = await fetchWithSession("/api/season-snapshot");
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Season Snapshot could not be loaded.");
    return { regular: payload.regular ?? [], playoffs: payload.playoffs ?? [], colorOrder: payload.colorOrder ?? [] };
  }, []);

  // The chart only changes when a week's last pick settles, which also changes
  // the standings the page already refreshes. So it loads only while the back is
  // showing, and only when those standings differ from what it last loaded this
  // visit. Turning the pad back and forth costs nothing, and there is no polling.
  const loadedFor = useRef<string | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    if (!active) return;
    const wanted = `${refreshKey}#${retry}`;
    if (loadedFor.current === wanted) return;
    const id = ++requestId.current;
    void fetchSnapshot().then((data) => {
      if (id !== requestId.current) return;
      loadedFor.current = wanted;
      setSnapshot(data);
      setError("");
      saveSetting(SNAPSHOT_KEY, JSON.stringify(data));
    }).catch((reason) => {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "Season Snapshot could not be loaded.");
    });
  }, [active, refreshKey, retry, fetchSnapshot]);

  // Once the playoffs begin a Regular | Playoffs switch appears and the chart opens on the playoffs. The
  // week-range toggle belongs to the regular-season chart only.
  const hasPlayoffs = isPlayoff || (snapshot?.playoffs.length ?? 0) > 0;
  const shownView = hasPlayoffs ? view : "regular";
  const showPlayoffs = shownView === "playoffs";
  const chooseView = (next: "regular" | "playoffs") => {
    setView(next);
    saveSetting(VIEW_KEY, next);
  };
  const chooseRange = (next: Range) => {
    setRange(next);
    saveSetting(RANGE_KEY, next);
  };

  return <div className="season-snapshot">
    <div className="pickem-ledger-masthead">
      <h2>Season Snapshot</h2>
      {hasPlayoffs ? <div aria-label="Season half shown" className="season-snapshot-range season-snapshot-view" role="group">
        <button aria-pressed={!showPlayoffs} onClick={() => chooseView("regular")} type="button">Season</button>
        <button aria-pressed={showPlayoffs} onClick={() => chooseView("playoffs")} type="button">Playoffs</button>
      </div> : null}
      {!showPlayoffs ? <div aria-label="Weeks shown" className="season-snapshot-range" role="group">
        <button aria-pressed={range === "all"} onClick={() => chooseRange("all")} type="button">All</button>
        <button aria-pressed={range === "six"} onClick={() => chooseRange("six")} type="button">6 Wk</button>
      </div> : null}
    </div>
    <div className="season-snapshot-body">
      {error ? <div className="season-snapshot-message" role="alert">{error} <button className="underline" onClick={() => setRetry((current) => current + 1)} type="button">Retry</button></div> : !snapshot ? <p className="season-snapshot-message">Loading scores…</p> : <SnapshotView isPlayoff={isPlayoff} key={showPlayoffs ? "playoffs" : "regular"} range={range} snapshot={snapshot} standings={standings} view={shownView} />}
    </div>
  </div>;
}
