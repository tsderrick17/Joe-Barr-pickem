"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { WheelIcon } from "@/components/commissioner/wheel-icons";

export type SpokeState = "ok" | "warn" | "bad" | "idle";

/** What a status ring says, for anyone who cannot see its colour. */
export const STATE_WORDS: Record<SpokeState, string> = { ok: "all good", warn: "look soon", bad: "needs you now", idle: "nothing to report" };

/** The mark on a medallion: the count when there is one, "!" for amber or red with no count, nothing otherwise. Never colour alone. */
export function pipText(state: SpokeState, count: number) {
  if (count > 0) return String(count);
  return state === "warn" || state === "bad" ? "!" : "";
}

/** One brass medallion with its status ring and, when something needs the Commissioner, a mark. */
export function Medallion({ icon, state, count = 0 }: { icon: string; state: SpokeState; count?: number }) {
  const pip = pipText(state, count);
  return <>
    <span aria-hidden="true" className={`cw-halo is-${state}`} />
    <span aria-hidden="true" className="cw-med"><WheelIcon className="cw-icon" name={icon} /></span>
    {pip ? <span aria-hidden="true" className={`cw-pip is-${state}`}>{pip}</span> : null}
  </>;
}

/** How long a sheet takes to slide away (ms). */
const SLIDE_MS = 240;

/**
 * A sheet that rises from the bottom on a phone and sits in the middle on a computer. It is the browser's own dialog, so focus stays inside
 * and focus goes back to the button that opened it. There is no X: a sheet is put away by sliding it down with a finger, by tapping the
 * handle at its top or the empty space above it, or with Escape, and every one of those slides it closed rather than blinking it out.
 * An untitled sheet keeps its title for screen readers only (the page inside it carries its own heading).
 * `guard` may hold a sheet open (it answers false: the page asks first, say about picks not sent); `closeSignal` going up slides it away.
 */
export function Sheet({ open, onClose, title, children, bare = false, untitled = false, guard, closeSignal = 0 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; bare?: boolean; untitled?: boolean; guard?: () => boolean; closeSignal?: number }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; dy: number; down: boolean | null } | null>(null);
  const leaving = useRef<number | null>(null);

  // Springs the sheet back to (or follows the finger from) where it rests.
  const lift = (dy: number, animate: boolean) => { const node = body.current; if (node) { node.style.transition = animate ? "transform .2s ease-out" : "none"; node.style.transform = dy > 0 ? `translateY(${dy}px)` : ""; } };
  // Slides the sheet down off the screen from wherever it is, then closes the dialog (whose close event tells the page).
  const slideAway = (forced = false) => {
    const dialog = ref.current;
    const node = body.current;
    if (!dialog || !dialog.open || leaving.current !== null) return;
    if (!forced && guard && !guard()) { lift(0, true); return; }   // held open: the page asks first
    const finish = () => { leaving.current = null; dialog.close(); dialog.classList.remove("is-leaving"); if (node) { node.style.transition = ""; node.style.transform = ""; } };
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    dialog.classList.add("is-leaving");
    node.style.transition = `transform ${SLIDE_MS}ms ease-in`;
    node.style.transform = `translateY(${window.innerHeight}px)`;
    leaving.current = window.setTimeout(finish, SLIDE_MS);
  };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && leaving.current !== null) {   // opened again while it was sliding away: bring it back
      window.clearTimeout(leaving.current);
      leaving.current = null;
      dialog.classList.remove("is-leaving");
      if (body.current) { body.current.style.transition = ""; body.current.style.transform = ""; }
    }
    if (open && !dialog.open) {
      dialog.showModal();
      // A bare sheet opens with focus on the sheet itself, not on its handle, so no focus ring is drawn on the handle for a finger.
      if (bare) dialog.focus({ preventScroll: true });
    }
    if (!open && dialog.open) slideAway(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on open/bare only; slideAway reads refs and the latest guard
  }, [open, bare]);
  useEffect(() => () => { if (leaving.current !== null) window.clearTimeout(leaving.current); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new signal slides it away
  useEffect(() => { if (closeSignal > 0) slideAway(true); }, [closeSignal]);

  // Whether the finger is on content scrolled to its top: the sheet itself, and every list inside it that scrolls on its own (a pop-up
  // scrolls only its data, under a heading that stands still).
  const atTop = (target: Element | null) => {
    for (let node = target; node && node !== body.current?.parentElement; node = node.parentElement) if (node.scrollTop > 0) return false;
    return true;
  };
  // Sliding it down with a finger puts it away. A pull only counts from the top of the content (otherwise it is the content scrolling) and
  // only when it goes mostly down (a swipe along a chart is the chart's); it follows the finger, and springs back unless it went far enough.
  return <dialog
    aria-label={title}
    className={`cw-sheet${bare ? " is-bare" : ""}${untitled ? " is-untitled" : ""}`}
    tabIndex={-1}
    onCancel={(event) => { event.preventDefault(); slideAway(); }}
    onClick={(event) => { if (event.target === event.currentTarget) slideAway(); }}
    onClose={onClose}
    ref={ref}
  >
    <div
      className="cw-sheet-body"
      onTouchEnd={() => { const pull = drag.current; drag.current = null; if (pull?.down && pull.dy > 90) slideAway(); else if (leaving.current === null) lift(0, true); }}
      onTouchMove={(event) => {
        const pull = drag.current;
        if (!pull) return;
        const dx = event.touches[0].clientX - pull.x;
        pull.dy = event.touches[0].clientY - pull.y;
        if (pull.down === null && Math.hypot(dx, pull.dy) > 6) pull.down = pull.dy > Math.abs(dx);
        if (pull.down && pull.dy > 0) lift(pull.dy, false);
      }}
      onTouchStart={(event) => { drag.current = atTop(event.target as Element) && leaving.current === null ? { x: event.touches[0].clientX, y: event.touches[0].clientY, dy: 0, down: null } : null; }}
      ref={body}
    >
      <button aria-label="Close" className="cw-handle" onClick={() => slideAway()} type="button" />
      <h2>{title}</h2>
      {open ? children : null}
    </div>
  </dialog>;
}
