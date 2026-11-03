"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { snapshotAxis, snapshotKeyColumns, snapshotRailStop, snapshotRibbons, snapshotRibbonPath, snapshotRoundGroups, snapshotRoundLines, snapshotStackOrder, snapshotStretch, snapshotThumb, snapshotWeekLines, snapshotWindowRange, snapshotX } from "@/lib/season-snapshot-chart.js";

type Player = { id: string; firstName: string; wins: number; eliminated?: boolean };
type Week = { id: string; label: string; day?: string; roundDays?: number; complete: boolean; scores: Array<{ playerId: string; wins: number }> };
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

// Tight margins: the axis labels sit right against the plot.
const AXIS_WIDTH = 30;
const PLOT_LEFT = 6;
const PLOT_RIGHT = 14;
/** The playoff chart by game day: room for a round's name centered under its last day (SUPER, half of it, spills right of the line). */
const PLOT_RIGHT_DAYS = 20;
// Room over the top line for the 6 Wk position rail; All keeps the same room, so both draw the axis in the same place.
const PLOT_TOP = 10;
const PLOT_BOTTOM = 18;
/** A playoff round's name may take two lines under its week line; each line past the first needs this much more room. */
const LABEL_LINE = 11;
/** The "6 Wk" view shows exactly this many weeks and scrolls a week at a time. */
const WINDOW_WEEKS = 6;
/** The narrowest a name's box in the player key may be, in rem: the same width the stylesheet gives it. */
const KEY_MIN_REM = 6.6;

/**
 * Where the 6-week view sits in the season, and the only way to move it: the chart itself does not scroll under a finger,
 * a wheel or a drag, so a flick never shifts the weeks by accident. The page draws the rail instead of the browser so it
 * matches the pad. It lies in the strip above the top line of the axis, which All keeps empty, so both views put the axis
 * and the week numbers in exactly the same place, and spans the grid lines, from the axis to where the lines end. Drag the
 * thumb or press the track and the view lands on the nearest week; the arrow keys step a week when it has focus. Only the
 * thin track shows; the part of the rail you can grab is taller, to be easy to catch with a thumb.
 */
function SnapshotRail({ scroller, step, weekCount }: { scroller: RefObject<HTMLDivElement | null>; step: number; weekCount: number }) {
  const [thumb, setThumb] = useState({ left: 0, width: 1, at: 0 });
  const [dragging, setDragging] = useState(false);
  // While a drag is on, how far along the thumb the pointer took hold (0 to 1 of the track).
  const grab = useRef<number | null>(null);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => {
      const next = { ...snapshotThumb(element.scrollLeft, element.clientWidth, element.scrollWidth), at: Math.max(0, Math.round(element.scrollLeft / step)) };
      setThumb((current) => current.left === next.left && current.width === next.width && current.at === next.at ? current : next);
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
  }, [scroller, step]);
  const along = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (event.clientX - box.left) / box.width;
  };
  const scrollTo = (left: number) => {
    const element = scroller.current;
    if (element) element.scrollTo({ left: snapshotRailStop(left, step, element.scrollWidth - element.clientWidth) });
  };
  const moveTo = (fraction: number) => {
    const element = scroller.current;
    if (element && grab.current !== null) scrollTo((fraction - grab.current) * element.scrollWidth);
  };
  const release = () => {
    grab.current = null;
    setDragging(false);
  };
  const keys: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageUp: -WINDOW_WEEKS, PageDown: WINDOW_WEEKS, Home: -Infinity, End: Infinity };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const weeks = keys[event.key];
    const element = scroller.current;
    if (weeks === undefined || !element) return;
    event.preventDefault();
    scrollTo(Number.isFinite(weeks) ? element.scrollLeft + weeks * step : weeks * element.scrollWidth);
  };
  // The first week in view, counting from 0, and the furthest it can be.
  const last = Math.max(0, weekCount - WINDOW_WEEKS);
  const first = Math.min(last, thumb.at);
  return <div
    aria-label="Move the weeks shown"
    aria-orientation="horizontal"
    aria-valuemax={last + 1}
    aria-valuemin={1}
    aria-valuenow={first + 1}
    aria-valuetext={`Weeks ${first + 1} to ${first + WINDOW_WEEKS}`}
    className={`season-snapshot-rail${dragging ? " is-dragging" : ""}`}
    onKeyDown={onKeyDown}
    onLostPointerCapture={release}
    onPointerCancel={release}
    onPointerDown={(event) => {
      const fraction = along(event);
      grab.current = fraction >= thumb.left && fraction <= thumb.left + thumb.width ? fraction - thumb.left : thumb.width / 2;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      moveTo(fraction);
    }}
    onPointerMove={(event) => moveTo(along(event))}
    onPointerUp={release}
    role="slider"
    tabIndex={0}
  >
    <div className="season-snapshot-rail-track">
      <span className="season-snapshot-rail-thumb" style={{ left: `${thumb.left * 100}%`, width: `${thumb.width * 100}%` }} />
    </div>
  </div>;
}

type Axis = { low: number; ceiling: number; tickStep: number };
// Every tick from the bottom up to the top, which is always a tick.
const axisTicks = ({ low, ceiling, tickStep }: Axis) => Array.from({ length: Math.floor((ceiling - low) / tickStep + 1e-9) + 1 }, (_, index) => low + index * tickStep);
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
  // A number that came back before the glide ended is current again, not leaving: one of each on the axis.
  const ticks = axisTicks(target);
  return { ...shown, ticks, leaving: leaving.filter((tick) => !ticks.includes(tick)) };
}

function SnapshotChart({
  title, showTitle, weeks, players, colors, baseline, hoverId, onHover, isPlayoff, windowed = false, emptyNote,
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
  /** Said over the empty plot when no week has been charted yet. */
  emptyNote?: string;
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
  // The playoffs are drawn a game day at a time: each day's weekday sits under its line and each round's name once under its days.
  const byDay = weeks.length > 0 && weeks.every((week) => week.day);
  const right = byDay ? PLOT_RIGHT_DAYS : PLOT_RIGHT;
  const viewport = Math.max(120, size.width - AXIS_WIDTH);
  const weekCount = Math.max(1, weeks.length);
  const scrolls = windowed && weeks.length > WINDOW_WEEKS;
  // In the 6-week view every week keeps a sixth of the visible width and the
  // extra weeks extend to the left; otherwise the season fits the view.
  const step = (viewport - PLOT_LEFT - right) / (scrolls ? WINDOW_WEEKS : weekCount);
  const plotWidth = scrolls ? PLOT_LEFT + step * weekCount + right : viewport;
  // Room under the plot for the names: one line, or two when a name takes two (a one-line name sits centered between them). Regular weeks
  // and playoff rounds without days name each week under its own line; game days put the weekday on the first line and the round's name below.
  const labels = weeks.map((week) => snapshotWeekLines(week.label));
  const rounds = byDay ? snapshotRoundGroups(weeks).map((group, index, all) => ({
    ...group,
    lines: snapshotRoundLines(group.label, (group.last - group.first + 1) * step, index === all.length - 1 ? right : undefined),
  })) : [];
  const nameLines = byDay ? Math.max(1, ...rounds.map((round) => round.lines.length)) : Math.max(1, ...labels.map((lines) => lines.length));
  const bottom = PLOT_BOTTOM + (nameLines - (byDay ? 0 : 1)) * LABEL_LINE;

  // The 6-week view always opens on the most recent six weeks.
  // The 6-week view draws exactly the weeks in view: the grid and the lines stop at the window's first and last week
  // instead of running on into the weeks either side. The clip follows the scroll without redrawing the chart.
  const gridWindow = useRef<SVGRectElement>(null);
  const lineWindow = useRef<SVGRectElement>(null);
  const fitWindow = () => {
    const left = scrollRef.current?.scrollLeft ?? 0;
    gridWindow.current?.setAttribute("x", String(left));
    lineWindow.current?.setAttribute("x", String(left + PLOT_LEFT));
  };
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && scrolls) element.scrollLeft = element.scrollWidth;
    fitWindow();
  }, [scrolls, plotWidth, weeks.length]);

  // The six-week stretch the axis is for, in weeks from the baseline: always a full six weeks, so the ends of the chart
  // (and the bounce past them) never shrink it. Kept to a twentieth of a week, so scrolling redraws only when the range
  // could change. Until the first scroll it is the latest six weeks, where the view opens.
  const edgesAt = (left: number) => snapshotStretch(left, step, weekCount, WINDOW_WEEKS);
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
    fitWindow();
    const next = edgesAt(element.scrollLeft);
    setScrolled((current) => current && current.from === next.from && current.to === next.to ? current : next);
  };

  // Only the players still on the chart shape the axis, so hiding the leader rescales the chart to the people who
  // remain. In the 6-week view it also fits the six-week stretch nearest the scroll and follows it as the chart scrolls; the whole regular
  // season always counts from zero, where everyone starts.
  const range = snapshotWindowRange(weeks, players, baseline, edges.from, edges.to);
  const target = snapshotAxis(range.min, range.max, !scrolls && !isPlayoff);
  const { low, ceiling, ticks, leaving } = useSpringAxis(target);
  const plotHeight = height - PLOT_TOP - bottom;
  const x = (weekIndex: number) => snapshotX(weekIndex, weekCount, plotWidth, PLOT_LEFT, right);
  const y = (wins: number) => PLOT_TOP + plotHeight * (1 - (wins - low) / (ceiling - low));
  const drawnTicks = [...ticks.map((tick) => ({ tick, gone: false })), ...leaving.map((tick) => ({ tick, gone: true }))];
  const clip = useId().replaceAll(":", "");
  // Lines that share a path stack by who held the greater total most recently.
  // Painting runs bottom lane first so the line that was ahead most recently is on top.
  const stacked = snapshotStackOrder(weeks, players, baseline);
  const rank = new Map(stacked.map((player, index) => [player.id, index]));
  // The 6-week view starts its lines at the whole week at or before its left edge: the starting points show only when
  // the window rests on a week, and while it moves between weeks they slide out of view instead of jumping in.
  const ribbons = snapshotRibbons(weeks, stacked, baseline, x, y, 3, scrolls ? Math.floor(edges.from) : 0)
    .sort((a, b) => (rank.get(b.playerId) ?? 0) - (rank.get(a.playerId) ?? 0));

  return <section className="season-snapshot-chart">
    {showTitle ? <h4 className="season-snapshot-chart-title">{title}</h4> : null}
    <div className="season-snapshot-row" ref={rowRef}>
      <svg aria-hidden="true" className="season-snapshot-yaxis" height={height} width={AXIS_WIDTH}>
        <clipPath id={`${clip}-axis`}><rect height={height - bottom + 6} width={AXIS_WIDTH} x={0} y={0} /></clipPath>
        <g clipPath={`url(#${clip}-axis)`}>
          {drawnTicks.map(({ tick, gone }) => <text className={`season-snapshot-tick${gone ? " is-leaving" : ""}`} fill="#536077" fontFamily="Arial, sans-serif" fontSize="11" key={tick} textAnchor="end" x={AXIS_WIDTH - 4} y={y(tick) + 4}>{tick}</text>)}
        </g>
        <text className="season-snapshot-axis-label" textAnchor="middle" transform={`translate(12 ${PLOT_TOP + plotHeight / 2}) rotate(-90)`}>Wins</text>
      </svg>
      <div aria-label={`${title}: cumulative wins by week`} className={`season-snapshot-plot-scroll ${scrolls ? "is-windowed" : ""}`} onScroll={scrolls ? onScroll : undefined} ref={scrollRef} role="group">
        <div className="season-snapshot-plot-track" style={{ width: plotWidth }}>
          <svg aria-label={`${title}, cumulative wins by week`} height={height} role="img" viewBox={`0 0 ${plotWidth} ${height}`} width={plotWidth}>
            {/* Grid and lines stay above the week numbers, even mid-glide. */}
            <clipPath id={`${clip}-plot`}><rect height={height - bottom + 2} width={plotWidth} x={0} y={0} /></clipPath>
            {scrolls ? <>
              <clipPath id={`${clip}-grid`}><rect height={height - bottom + 2} ref={gridWindow} width={viewport - PLOT_RIGHT} y={0} /></clipPath>
              <clipPath id={`${clip}-window`}><rect height={height} ref={lineWindow} width={viewport - PLOT_LEFT - PLOT_RIGHT} y={0} /></clipPath>
            </> : null}
            <g clipPath={`url(#${clip}-${scrolls ? "grid" : "plot"})`}>
              {drawnTicks.map(({ tick, gone }) => <line className={`season-snapshot-tick${gone ? " is-leaving" : ""}`} key={tick} stroke="#d9d2c3" x1={0} x2={plotWidth - right} y1={y(tick)} y2={y(tick)} />)}
            </g>
            {weeks.map((week, index) => <g key={week.id}>
              <line stroke="#e8e0d1" strokeDasharray="2 4" x1={x(index + 1)} x2={x(index + 1)} y1={PLOT_TOP} y2={height - bottom} />
              {byDay
                ? (week.roundDays ?? 2) > 1 ? <text fill="#536077" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" textAnchor="middle" x={x(index + 1)} y={height - 5 - nameLines * LABEL_LINE}>{week.day}</text> : null
                : labels[index].map((line, lineIndex) => <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" key={lineIndex} textAnchor={index === weeks.length - 1 ? "end" : "middle"} x={x(index + 1)} y={height - 5 - (bottom - PLOT_BOTTOM) / 2 + (lineIndex - (labels[index].length - 1) / 2) * LABEL_LINE}>{line}</text>)}
            </g>)}
            {rounds.map((round) => <g key={`${round.label}:${round.first}`}>
              {round.lines.map((line, lineIndex) => <text fill="#39465b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" key={lineIndex} textAnchor="middle" x={(x(round.first + 1) + x(round.last + 1)) / 2} y={height - 5 - ((nameLines - 1) * LABEL_LINE) / 2 + (lineIndex - (round.lines.length - 1) / 2) * LABEL_LINE}>{line}</text>)}
            </g>)}
            {/* The window clip sits on a wrapper: the reveal animation's own clip-path replaces one on the lines' group. */}
            <g clipPath={scrolls ? `url(#${clip}-window)` : undefined}><g className="season-snapshot-lines" clipPath={`url(#${clip}-plot)`}>
              {ribbons.map((ribbon) => <g className={`season-snapshot-ribbon ${hoverId && hoverId !== ribbon.playerId ? "is-dim" : ""}`} key={`${ribbon.weekIndex}:${ribbon.playerId}`} onMouseEnter={() => onHover(ribbon.playerId)} onMouseLeave={() => onHover(null)}>
                <path d={snapshotRibbonPath(ribbon.points)} fill={colors.get(ribbon.playerId)} />
                <path d={snapshotRibbonPath(ribbon.points, 0, 0.22)} fill="white" fillOpacity="0.32" />
                <path d={snapshotRibbonPath(ribbon.points, 0.78, 1)} fill="#102030" fillOpacity="0.3" />
              </g>)}
            </g></g>
          </svg>
        </div>
      </div>
      {scrolls ? <SnapshotRail scroller={scrollRef} step={step} weekCount={weekCount} /> : null}
      {emptyNote ? <p className="season-snapshot-empty">{emptyNote}</p> : null}
    </div>
    <p aria-hidden="true" className="season-snapshot-week-label">{byDay ? "Game day" : "Week"}</p>
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
  // The key's rows come out even (six and five, not eight and three): how many names go across follows from the room there is.
  const keyRef = useRef<HTMLDivElement>(null);
  const [keyColumns, setKeyColumns] = useState<number | null>(null);
  const names = keyRows.length;
  useLayoutEffect(() => {
    const element = keyRef.current;
    if (!element) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const columns = snapshotKeyColumns(names, element.clientWidth, KEY_MIN_REM * rem, parseFloat(getComputedStyle(element).columnGap) || 0);
      setKeyColumns((current) => current === columns ? current : columns);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [names]);

  return <div className="season-snapshot-layout">
    <div className="season-snapshot-charts">
      {/* The playoff chart replaces the regular-season chart; it starts from each
          player's final regular-season total. */}
      {showPlayoffs
        ? <SnapshotChart baseline={playoffBaseline} colors={colors} emptyNote={snapshot.playoffs.length ? undefined : "Fills in once the first playoff day is final."} hoverId={hoverId} isPlayoff onHover={setHoverId} players={visible} showTitle={false} title="Playoffs" weeks={snapshot.playoffs} />
        : <SnapshotChart baseline={{}} colors={colors} hoverId={hoverId} isPlayoff={false} onHover={setHoverId} players={visible} showTitle={false} title="Regular season" weeks={snapshot.regular} windowed={range === "six"} />}
    </div>
    <div aria-label="Players shown on the chart" className="season-snapshot-key" ref={keyRef} style={keyColumns ? { "--key-columns": keyColumns } as CSSProperties : undefined}>
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
  // True once the Playoffs half was pressed this visit: until a playoff round is charted it is an empty page, so the chart opens on Season instead.
  const [askedForPlayoffs, setAskedForPlayoffs] = useState(false);
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

  // Once the playoffs begin a Season | Playoffs switch appears and the chart opens on the playoffs (on Season until the first playoff
  // round is final, when the Playoffs half has nothing to draw yet). The week-range toggle belongs to the regular-season chart only.
  const hasPlayoffs = isPlayoff || (snapshot?.playoffs.length ?? 0) > 0;
  const nothingCharted = snapshot !== null && snapshot.playoffs.length === 0;
  const shownView = hasPlayoffs ? (nothingCharted && !askedForPlayoffs ? "regular" : view) : "regular";
  const showPlayoffs = shownView === "playoffs";
  const chooseView = (next: "regular" | "playoffs") => {
    setView(next);
    setAskedForPlayoffs(next === "playoffs");
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
