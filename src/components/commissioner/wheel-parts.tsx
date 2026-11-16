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

/**
 * A sheet that rises from the bottom on a phone and sits in the middle on a computer. It is the browser's own dialog, so focus stays inside,
 * Escape closes it and focus goes back to the button that opened it. Tapping outside closes it too.
 */
export function Sheet({ open, onClose, title, children, bare = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; bare?: boolean }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  // A bare sheet is just its picture, with a small handle at the top: slide it down with a finger to put it away. A pull only counts from
  // the top of the content (otherwise it is the content scrolling), and it springs back unless it went far enough.
  const lift = (dy: number, animate: boolean) => { const node = body.current; if (node) { node.style.transition = animate ? "transform .2s ease-out" : "none"; node.style.transform = dy > 0 ? `translateY(${dy}px)` : ""; } };
  return <dialog
    aria-label={title}
    className={`cw-sheet${bare ? " is-bare" : ""}`}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onClose={onClose}
    ref={ref}
  >
    <div
      className="cw-sheet-body"
      onTouchEnd={bare ? () => { const pull = drag.current; drag.current = null; if (pull && pull.dy > 90) onClose(); lift(0, true); } : undefined}
      onTouchMove={bare ? (event) => { const pull = drag.current; if (!pull) return; pull.dy = event.touches[0].clientY - pull.y; if (pull.dy > 0) lift(pull.dy, false); } : undefined}
      onTouchStart={bare ? (event) => { drag.current = (body.current?.scrollTop ?? 0) <= 0 ? { y: event.touches[0].clientY, dy: 0 } : null; } : undefined}
      ref={body}
    >
      {bare ? <button aria-label="Close" className="cw-handle" onClick={onClose} type="button" /> : <>
        <div aria-hidden="true" className="cw-grab" />
        <button aria-label="Close" className="cw-close" onClick={onClose} type="button"><WheelIcon name="close" /></button>
      </>}
      <h2>{title}</h2>
      {open ? children : null}
    </div>
  </dialog>;
}
