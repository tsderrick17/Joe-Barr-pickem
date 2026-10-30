"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cellSize, glide, mergeSaved, patchSize, tileBox, visibleCopies, WORKSHOP_PATCH as PATCH, WORKSHOP_SAVED_KEY, zoomAt } from "@/lib/workshop-board.js";
import { changedSummary, defaultSettings, KNOBS, knobsFor, liveKnobs, pieceById, SAVED_RULES, type Piece, type Settings } from "@/components/workshop-pieces";

/**
 * The Workshop: every custom piece of the pool on one board with no edges. Drag (or swipe, or scroll) to move around; the patch of pieces
 * repeats forever, so there is always more. Pinch, ctrl-scroll or the + and - buttons zoom. Tapping a piece plays it. Its settings stay out of
 * sight until its tune button is tapped, which opens them in a panel (from the right on a computer, from the bottom on a phone).
 * Settings are remembered on this device; Copy settings gives the text to send so a value becomes what players see.
 */

type Camera = { x: number; y: number; zoom: number };
type Copy = { key: string; left: number; top: number };
const DRAG_START = 6;   // px a finger moves before a tap becomes a drag
const HOME = { x: 12, y: 64, zoom: 1 };

function readSettings(): Settings {
  try {
    const saved = window.localStorage.getItem(WORKSHOP_SAVED_KEY);
    return saved ? mergeSaved(defaultSettings(), JSON.parse(saved), SAVED_RULES) as Settings : defaultSettings();
  } catch { return defaultSettings(); }
}

const tuneIcon = (
  <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 16 16" width="14">
    <path d="M2 4h12M2 8h12M2 12h12" /><circle cx="5" cy="4" fill="currentColor" r="1.6" /><circle cx="11" cy="8" fill="currentColor" r="1.6" /><circle cx="7" cy="12" fill="currentColor" r="1.6" />
  </svg>
);

/** One copy of a piece. Tapping plays only this copy; the settings are shared with every other copy. */
function Tile({ piece, box, settings, update, copy, labels, selected, onTune }: { piece: Piece; box: CSSProperties; settings: Settings; update: (change: (current: Settings) => Settings) => void; copy: string; labels: boolean; selected: boolean; onTune: () => void }) {
  const [plays, setPlays] = useState(0);
  const play = () => setPlays((count) => count + 1);
  const tap = piece.tapToPlay ? {
    "aria-label": `Play the ${piece.title.toLowerCase()}`,
    onClick: play,
    onKeyDown: (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); play(); } },
    role: "button",
    tabIndex: 0,
  } : {};
  return (
    <div className={`workshop-tile ${piece.dark ? "is-dark" : ""} ${selected ? "is-selected" : ""}`} data-piece={piece.id} style={box}>
      <div className={`workshop-stage ${piece.tapToPlay ? "is-playable" : ""}`} style={{ ...piece.style?.(settings), "--asset-zoom": piece.zoom ?? 1 } as CSSProperties} {...tap}>
        {piece.draw({ settings, update, plays, play, copy })}
      </div>
      {labels ? <span className="workshop-label">{piece.title}</span> : null}
      {piece.controls || piece.knobGroup ? <button aria-label={`Tune the ${piece.title.toLowerCase()}`} className="workshop-tune" onClick={onTune} type="button">{tuneIcon}</button> : null}
    </div>
  );
}

/** The settings of one piece, out of the way until asked for. */
function TunePanel({ piece, settings, update, onClose }: { piece: Piece; settings: Settings; update: (change: (current: Settings) => Settings) => void; onClose: () => void }) {
  const group = piece.knobGroup;
  const resetGroup = () => group && update((current) => ({ ...current, knobs: { ...current.knobs, ...Object.fromEntries(KNOBS[group].map((knob) => [knob.key, knob.live])) } }));
  return (
    <aside aria-label={`${piece.title} settings`} className="workshop-panel" role="dialog">
      <header>
        <h2>{piece.title}</h2>
        <button aria-label="Close settings" className="workshop-close" onClick={onClose} type="button">
          <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 14 14" width="14"><path d="M2 2l10 10M12 2L2 12" /></svg>
        </button>
      </header>
      <p>{piece.note}</p>
      <div className="workshop-panel-controls">
        {piece.controls?.(settings, update)}
        {group ? knobsFor(group, settings, update) : null}
      </div>
      {piece.actions || group ? (
        <div className="asset-actions">
          {piece.actions?.(settings, update)}
          {group ? <button className="asset-replay" onClick={resetGroup} type="button">Live values</button> : null}
        </div>
      ) : null}
    </aside>
  );
}

export default function WorkshopBoard() {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const update = useCallback((change: (current: Settings) => Settings) => setSettings(change), []);
  const [tuning, setTuning] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moved, setMoved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [night, setNight] = useState(() => { try { return window.localStorage.getItem("pickem-theme") === "night"; } catch { return document.documentElement.dataset.theme === "night"; } });
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [copies, setCopies] = useState<Copy[]>([]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const camera = useRef<Camera>({ ...HOME });
  const copiesKey = useRef("");
  const cell = cellSize(viewport.width);
  const patch = patchSize(PATCH.cols, PATCH.rows, cell);
  const layout = useRef({ viewport, patch, cell });
  useLayoutEffect(() => { layout.current = { viewport, patch, cell }; });

  /** Moves the board to the camera, and swaps in the copies of the patch that are now on screen (and one cell beyond). */
  const apply = useCallback(() => {
    const view = camera.current;
    if (worldRef.current) worldRef.current.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`;
    const { viewport: size, patch: area, cell: margin } = layout.current;
    const next = visibleCopies(view, size, area, margin);
    const key = next.map((entry: Copy) => entry.key).join("|");
    if (key !== copiesKey.current) { copiesKey.current = key; setCopies(next); }
  }, []);
  useLayoutEffect(() => { apply(); }, [apply, viewport, cell]);

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    // The page underneath must not scroll while the board is up.
    document.documentElement.classList.add("has-workshop");
    return () => { window.removeEventListener("resize", resize); document.documentElement.classList.remove("has-workshop"); };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(WORKSHOP_SAVED_KEY, JSON.stringify(settings)); } catch { /* this device keeps nothing; the board still works */ }
  }, [settings]);

  // ---- moving the board ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ startX: 0, startY: 0, dragging: false, speedX: 0, speedY: 0, at: 0, pinch: 0 });
  const swallowClick = useRef(false);
  const fling = useRef(0);

  const stopFling = () => { if (fling.current) cancelAnimationFrame(fling.current); fling.current = 0; };
  const panBy = useCallback((dx: number, dy: number) => { camera.current = { ...camera.current, x: camera.current.x + dx, y: camera.current.y + dy }; apply(); }, [apply]);
  const zoomBy = useCallback((factor: number, point = { x: layout.current.viewport.width / 2, y: layout.current.viewport.height / 2 }) => { camera.current = zoomAt(camera.current, factor, point); apply(); }, [apply]);
  const goHome = () => { stopFling(); camera.current = { ...HOME }; apply(); };

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-own-gestures]")) return;
    stopFling();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const state = drag.current;
    if (pointers.current.size === 1) Object.assign(state, { startX: event.clientX, startY: event.clientY, dragging: false, speedX: 0, speedY: 0, at: event.timeStamp });
    if (pointers.current.size === 2) { state.dragging = true; state.pinch = spread().distance; boardRef.current?.setPointerCapture(event.pointerId); }
    swallowClick.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    const state = drag.current;
    if (pointers.current.size === 2) {
      const before = spread();
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = spread();
      camera.current = zoomAt(camera.current, after.distance / Math.max(1, before.distance), after);
      panBy(after.x - before.x, after.y - before.y);
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!state.dragging) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < DRAG_START) return;
      state.dragging = true;
      swallowClick.current = true;
      boardRef.current?.setPointerCapture(event.pointerId);
      if (!moved) setMoved(true);
    }
    const dx = event.clientX - last.x, dy = event.clientY - last.y;
    const dt = Math.max(1, event.timeStamp - state.at);
    state.speedX = state.speedX * 0.6 + (dx / dt) * 0.4;
    state.speedY = state.speedY * 0.6 + (dy / dt) * 0.4;
    state.at = event.timeStamp;
    panBy(dx, dy);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    const state = drag.current;
    if (pointers.current.size === 1) {
      // One finger of a pinch lifted: the other carries on dragging from where it is.
      const [rest] = [...pointers.current.values()];
      Object.assign(state, { startX: rest.x, startY: rest.y, speedX: 0, speedY: 0 });
      return;
    }
    if (!state.dragging || event.timeStamp - state.at > 80) return;
    // A fling: the board glides on and slows to a stop.
    let { speedX, speedY } = state;
    let previous = performance.now();
    const step = (now: number) => {
      const dt = now - previous;
      previous = now;
      panBy(speedX * dt, speedY * dt);
      speedX = glide(speedX, dt);
      speedY = glide(speedY, dt);
      fling.current = Math.hypot(speedX, speedY) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    if (Math.hypot(speedX, speedY) > 0.1) fling.current = requestAnimationFrame(step);
  };

  // A drag that started on a piece must not also play it.
  const onClickCapture = (event: MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  // Scrolling moves the board; ctrl-scroll (and a trackpad pinch, which arrives as one) zooms where the pointer is.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest(".workshop-panel, .workshop-menu")) return;
      event.preventDefault();
      stopFling();
      if (event.ctrlKey) zoomBy(Math.exp(-event.deltaY * 0.01), { x: event.clientX, y: event.clientY });
      else panBy(-event.deltaX, -event.deltaY);
    };
    board.addEventListener("wheel", wheel, { passive: false });
    return () => board.removeEventListener("wheel", wheel);
  }, [panBy, zoomBy]);

  const onBoardKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
    if (moves[event.key]) { event.preventDefault(); panBy(...moves[event.key]); }
    else if (event.key === "+" || event.key === "=") zoomBy(1.2);
    else if (event.key === "-") zoomBy(1 / 1.2);
    else if (event.key === "0") goHome();
  };

  // Escape closes the panel, then the menu.
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (tuning) setTuning(null);
      else setMenuOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [tuning]);

  // ---- the menu ----
  const summary = changedSummary(settings.knobs);
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary.text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* the text is on screen to copy by hand */ }
  };
  const toggleNight = () => {
    const next = !night;
    document.documentElement.dataset.theme = next ? "night" : "day";
    try { window.localStorage.setItem("pickem-theme", next ? "night" : "day"); } catch { /* none */ }
    window.dispatchEvent(new Event("pickem-theme-change"));
    setNight(next);
  };
  const tuned = tuning ? pieceById(tuning) : undefined;

  return (
    <div className={`workshop ${tuned ? "has-panel" : ""}`}>
      <div
        aria-label="Workshop board. Drag or use the arrow keys to move around; tap a piece to play it."
        className="workshop-board"
        data-no-pull-refresh=""
        onClickCapture={onClickCapture}
        onKeyDown={onBoardKey}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={boardRef}
        role="region"
        tabIndex={0}
      >
        <div className="workshop-world" ref={worldRef}>
          {copies.map((entry) => PATCH.tiles.map((place) => {
            const piece = pieceById(place.id);
            if (!piece) return null;
            const box = tileBox(place, cell);
            return (
              <Tile
                box={{ height: box.height, left: entry.left + box.left, top: entry.top + box.top, width: box.width }}
                copy={entry.key}
                key={`${entry.key}-${place.id}`}
                labels={settings.view.labels}
                onTune={() => { setTuning(piece.id); setMenuOpen(false); }}
                piece={piece}
                selected={tuning === piece.id}
                settings={settings}
                update={update}
              />
            );
          }))}
        </div>
      </div>

      <Link className="workshop-chrome workshop-back" href="/admin">
        <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 8 12" width="8"><path d="M6.5 1.5L2 6l4.5 4.5" /></svg>
        Desk
      </Link>
      <h1 className="workshop-title">Workshop</h1>

      <div className="workshop-menu-wrap">
        <button aria-expanded={menuOpen} className="workshop-chrome" onClick={() => setMenuOpen((open) => !open)} type="button">
          Menu{summary.count ? <span className="workshop-count">{summary.count}</span> : null}
        </button>
        {menuOpen ? (
          <div aria-label="Workshop menu" className="workshop-menu" role="group">
            <label className="workshop-switch">
              <input checked={settings.view.labels} onChange={(event) => { const labels = event.target.checked; update((current) => ({ ...current, view: { labels } })); }} type="checkbox" />
              Show names
            </label>
            <label className="workshop-switch">
              <input checked={night} onChange={toggleNight} type="checkbox" />
              Night
            </label>
            <div className="workshop-settings">
              <h2>Your settings</h2>
              <p>Anything changed from the live value. Copy it and send it over to make it the new default.</p>
              <pre>{summary.text}</pre>
              <div className="asset-actions">
                <button className="asset-replay" disabled={!summary.count} onClick={() => void copy()} type="button">{copied ? "Copied" : "Copy settings"}</button>
                <button className="asset-replay" disabled={!summary.count} onClick={() => update((current) => ({ ...current, knobs: liveKnobs() }))} type="button">Reset all</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div aria-label="Zoom" className="workshop-zoom" role="group">
        <button aria-label="Zoom out" className="workshop-chrome" onClick={() => zoomBy(1 / 1.25)} type="button">−</button>
        <button className="workshop-chrome" onClick={goHome} type="button">Home</button>
        <button aria-label="Zoom in" className="workshop-chrome" onClick={() => zoomBy(1.25)} type="button">+</button>
      </div>

      {!moved && !tuned ? <p className="workshop-hint">Drag to look around · tap a piece to play it · tap its tune button to change it</p> : null}

      {tuned ? <TunePanel onClose={() => setTuning(null)} piece={tuned} settings={settings} update={update} /> : null}
    </div>
  );
}
