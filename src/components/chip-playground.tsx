"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

// How far the chip turns per pixel of drag.
const DRAG_DEGREES_PER_PIXEL = 1.9;

// The Survivor toss (the same curve as `survivor-chip-toss` in globals.css):
// at each stop, how far through its three turns the chip is, a slight
// side-to-side wobble, and its lift and swell as it rises toward you.
const TOSS = [
  { at: 0, turn: 0 / 1080, wobble: 0, lift: -1, scale: 1.000 },
  { at: 0.06, turn: -6 / 1080, wobble: 0, lift: 0.5, scale: 0.975 },
  { at: 0.1, turn: 54 / 1080, wobble: 1.55, lift: -3.28, scale: 1.032 },
  { at: 0.14, turn: 108 / 1080, wobble: 2.94, lift: -5.32, scale: 1.061 },
  { at: 0.18, turn: 162 / 1080, wobble: 4.05, lift: -7.12, scale: 1.087 },
  { at: 0.22, turn: 216 / 1080, wobble: 4.76, lift: -8.68, scale: 1.109 },
  { at: 0.26, turn: 270 / 1080, wobble: 5, lift: -10, scale: 1.127 },
  { at: 0.3, turn: 324 / 1080, wobble: 4.76, lift: -11.08, scale: 1.143 },
  { at: 0.34, turn: 378 / 1080, wobble: 4.05, lift: -11.92, scale: 1.155 },
  { at: 0.38, turn: 432 / 1080, wobble: 2.94, lift: -12.52, scale: 1.163 },
  { at: 0.42, turn: 486 / 1080, wobble: 1.55, lift: -12.88, scale: 1.168 },
  { at: 0.46, turn: 540 / 1080, wobble: 0, lift: -13, scale: 1.170 },
  { at: 0.5, turn: 594 / 1080, wobble: -1.55, lift: -12.88, scale: 1.168 },
  { at: 0.54, turn: 648 / 1080, wobble: -2.94, lift: -12.52, scale: 1.163 },
  { at: 0.58, turn: 702 / 1080, wobble: -4.05, lift: -11.92, scale: 1.155 },
  { at: 0.62, turn: 756 / 1080, wobble: -4.76, lift: -11.08, scale: 1.143 },
  { at: 0.66, turn: 810 / 1080, wobble: -5, lift: -10, scale: 1.127 },
  { at: 0.7, turn: 864 / 1080, wobble: -4.76, lift: -8.68, scale: 1.109 },
  { at: 0.74, turn: 918 / 1080, wobble: -4.05, lift: -7.12, scale: 1.087 },
  { at: 0.78, turn: 972 / 1080, wobble: -2.94, lift: -5.32, scale: 1.061 },
  { at: 0.82, turn: 1026 / 1080, wobble: -1.55, lift: -3.28, scale: 1.032 },
  { at: 0.86, turn: 1080 / 1080, wobble: -0, lift: -1, scale: 1.000 },
  { at: 0.895, turn: 1090 / 1080, wobble: 0, lift: -2.2, scale: 1.000 },
  { at: 0.93, turn: 1075 / 1080, wobble: 0, lift: -0.6, scale: 1.000 },
  { at: 0.96, turn: 1083 / 1080, wobble: 0, lift: -1.2, scale: 1.000 },
  { at: 0.98, turn: 1079 / 1080, wobble: 0, lift: -1, scale: 1.000 },
  { at: 1, turn: 1080 / 1080, wobble: 0, lift: -1, scale: 1.000 },
];

/** A Raiders chip on the Operations desk to toss (click) or turn by hand (drag),
 *  for checking the chip from every angle. Nothing here touches pool data. */
export default function ChipPlayground() {
  const [turn, setTurn] = useState({ x: 0, y: 0 });
  const [turning, setTurning] = useState(false);
  const turnRef = useRef(turn);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const host = useRef<HTMLButtonElement | null>(null);

  function setTurnNow(next: { x: number; y: number }) {
    turnRef.current = next;
    setTurn(next);
  }

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (turning) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, startX: turnRef.current.x, startY: turnRef.current.y, moved: false };
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 3) return;
    current.moved = true;
    setTurnNow({ x: current.startX - dy * DRAG_DEGREES_PER_PIXEL, y: current.startY + dx * DRAG_DEGREES_PER_PIXEL });
  }

  /** The Survivor toss from wherever the chip is now: three turns, landing back in the same position. */
  function toss() {
    const chip = host.current?.querySelector<HTMLElement>(".survivor-poker-chip");
    if (!chip) return;
    const from = turnRef.current;
    // Three full turns end over end, landing exactly where it started.
    const to = { x: from.x + 1080, y: from.y };
    const frames = TOSS.map((stop) => ({
      offset: stop.at,
      transform: `translateY(${stop.lift}px) rotateX(${from.x + (to.x - from.x) * stop.turn}deg) rotateY(${from.y + stop.wobble}deg) scale(${stop.scale})`,
    }));
    setTurning(true);
    const animation = chip.animate(frames, { duration: 900, easing: "linear" });
    animation.onfinish = () => {
      setTurnNow(to);
      setTurning(false);
    };
    animation.oncancel = () => setTurning(false);
  }

  function up() {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved && !turning) toss();
  }

  return (
    <button
      aria-label="Test chip: click to flip, drag to turn"
      className="chip-playground"
      onPointerCancel={() => { drag.current = null; }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      ref={host}
      style={{ "--playground-x": `${turn.x}deg`, "--playground-y": `${turn.y}deg` } as CSSProperties}
      title="Click to flip, drag to turn"
      type="button"
    >
      <SurvivorPokerChip abbreviation="LV" showEdge teamName="Las Vegas Raiders" tooltip="Click to flip, drag to turn" />
    </button>
  );
}
