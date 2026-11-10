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
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog
    aria-label={title}
    className="cw-sheet"
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onClose={onClose}
    ref={ref}
  >
    <div className="cw-sheet-body">
      <div aria-hidden="true" className="cw-grab" />
      <button aria-label="Close" className="cw-close" onClick={onClose} type="button"><WheelIcon name="close" /></button>
      <h2>{title}</h2>
      {open ? children : null}
    </div>
  </dialog>;
}
