"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

// How far the chip turns per pixel of drag.
const DRAG_DEGREES_PER_PIXEL = 1.9;

// The Survivor toss, as how far through its three turns the chip is at each
// stop (the same curve as `survivor-chip-toss` in globals.css), with its lift
// and swell.
const TOSS = [
  { at: 0, turn: 0, lift: -1, scale: 1 },
  { at: 0.08, turn: 132 / 1080, lift: -4, scale: 1.035 },
  { at: 0.17, turn: 300 / 1080, lift: -7, scale: 1.065 },
  { at: 0.28, turn: 510 / 1080, lift: -8, scale: 1.08 },
  { at: 0.4, turn: 700 / 1080, lift: -7, scale: 1.075 },
  { at: 0.52, turn: 858 / 1080, lift: -5, scale: 1.06 },
  { at: 0.64, turn: 976 / 1080, lift: -4, scale: 1.045 },
  { at: 0.76, turn: 1046 / 1080, lift: -3, scale: 1.028 },
  { at: 0.88, turn: 1088 / 1080, lift: -2, scale: 1.012 },
  { at: 1, turn: 1, lift: -1, scale: 1 },
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

  /** The Survivor toss from wherever the chip is now: three turns, landing flat and face up. */
  function toss() {
    const chip = host.current?.querySelector<HTMLElement>(".survivor-poker-chip");
    if (!chip) return;
    const from = turnRef.current;
    // Land on the nearest flat orientation, after three more full turns.
    const to = { x: 360 * Math.round(from.x / 360) + 1080, y: 360 * Math.round(from.y / 360) };
    const frames = TOSS.map((stop) => ({
      offset: stop.at,
      transform: `translateY(${stop.lift}px) rotateX(${from.x + (to.x - from.x) * stop.turn}deg) rotateY(${from.y + (to.y - from.y) * stop.turn}deg) scale(${stop.scale})`,
    }));
    setTurning(true);
    const animation = chip.animate(frames, { duration: 680, easing: "cubic-bezier(.16,.76,.2,1)" });
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
