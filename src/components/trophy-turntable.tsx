"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { championRoll } from "@/lib/trophy-roll.js";

/**
 * The three trophies on a triangular table that turns. The table is a set of 60 pictures, one for every 6 degrees of a full turn
 * (rendered once, see tools/trophy-render); dragging or swiping moves through them, letting go settles the nearest trophy at the
 * front, and the arrows at the sides bring the next one forward. Each trophy's brass plaques are part of the pictures, so the
 * champions are also listed in plain text below, straight from the records.
 */
type Champion = { name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };

const FRAMES = 60;
const STEP = 360 / FRAMES;      // degrees between pictures
const REST = 120;               // degrees between one trophy at the front and the next
const TROPHIES = [{ pool: "pickem", label: "Pick’em" }, { pool: "bowl", label: "Bowl Pool" }, { pool: "survivor", label: "Survivor" }] as const;
const DRAG_DEGREES_PER_PIXEL = 0.3;

const wrap = (angle: number) => ((angle % 360) + 360) % 360;
const frameSrc = (index: number) => `/trophies/turntable/frame-${String(index).padStart(3, "0")}.webp`;
const frontIndex = (angle: number) => Math.round(wrap(angle) / REST) % TROPHIES.length;

export default function TrophyTurntable({ seasons }: { seasons: Season[] }) {
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);
  const frame = useRef<number | null>(null);
  const drag = useRef<{ startX: number; startAngle: number } | null>(null);

  const show = useCallback((next: number) => { angleRef.current = next; setAngle(next); }, []);

  /** Turn smoothly to an angle by the short way round. */
  const turnTo = useCallback((target: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const from = angleRef.current, delta = ((target - from + 540) % 360) - 180;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || delta === 0) { show(from + delta); return; }
    const start = performance.now(), duration = 260 + Math.abs(delta) * 3.2;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 3);
      show(from + delta * eased);
      frame.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frame.current = requestAnimationFrame(tick);
  }, [show]);

  const turnBy = useCallback((steps: number) => turnTo(Math.round(angleRef.current / REST) * REST + steps * REST), [turnTo]);

  useEffect(() => {
    // fetch the rest of the turn in the background so a drag never waits for a picture
    const loaders: HTMLImageElement[] = [];
    for (let index = 0; index < FRAMES; index += 1) { const image = new window.Image(); image.src = frameSrc(index); loaders.push(image); }
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);

  const front = frontIndex(angle);
  const index = Math.round(wrap(angle) / STEP) % FRAMES;

  return (
    <div>
      <div
        aria-label="The trophies on their table. Drag, or use the arrow keys, to turn it."
        className="trophy-turn-stage"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); turnBy(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); turnBy(1); }
        }}
        onPointerCancel={() => { drag.current = null; }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
          drag.current = { startX: event.clientX, startAngle: angleRef.current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          show(drag.current.startAngle - (event.clientX - drag.current.startX) * DRAG_DEGREES_PER_PIXEL);   // dragging left brings the trophy on the right forward
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current = null;
          turnTo(Math.round(angleRef.current / REST) * REST);
        }}
        role="group"
        tabIndex={0}
      >
        <Image alt={`The ${TROPHIES[front].label} trophy at the front of the table`} draggable={false} height={825} priority src={frameSrc(index)} unoptimized width={1100} />
        <button aria-label="Bring the previous trophy forward" className="trophy-turn-arrow" data-side="left" onClick={() => turnBy(-1)} type="button">‹</button>
        <button aria-label="Bring the next trophy forward" className="trophy-turn-arrow" data-side="right" onClick={() => turnBy(1)} type="button">›</button>
        <p aria-live="polite" className="sr-only" role="status">{TROPHIES[front].label} is at the front</p>
      </div>
      <div className="trophy-rolls">
        {TROPHIES.map((trophy, position) => {
          const roll = championRoll(seasons, trophy.pool);
          return (
            <section data-front={position === front ? "true" : "false"} key={trophy.pool}>
              <h3>{trophy.label}</h3>
              {roll.length ? <ul>{roll.map((entry) => <li key={entry.year}><span>{entry.year}</span> {entry.names}</li>)}</ul> : <p>No champion yet.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
