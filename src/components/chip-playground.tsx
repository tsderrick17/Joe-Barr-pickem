"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

// How far the chip turns per pixel of drag.
const DRAG_DEGREES_PER_PIXEL = 1.9;

// The Survivor toss (the same curve as `survivor-chip-toss` in globals.css):
// at each stop, how far through its three turns the chip is, a slight
// side-to-side wobble, and its lift and swell as it rises toward you.
const TOSS = [
  { at: 0, turn: 0 / 1080, wobble: 0, lift: 0, scale: 1.000 },
  { at: 0.06, turn: -6 / 1080, wobble: 0, lift: 1.5, scale: 0.975 },
  { at: 0.0992, turn: 45 / 1080, wobble: 1.29, lift: -1.92, scale: 1.027 },
  { at: 0.1383, turn: 90 / 1080, wobble: 2.5, lift: -3.67, scale: 1.052 },
  { at: 0.1775, turn: 135 / 1080, wobble: 3.54, lift: -5.25, scale: 1.074 },
  { at: 0.2167, turn: 180 / 1080, wobble: 4.33, lift: -6.67, scale: 1.094 },
  { at: 0.2558, turn: 225 / 1080, wobble: 4.83, lift: -7.92, scale: 1.112 },
  { at: 0.295, turn: 270 / 1080, wobble: 5, lift: -9, scale: 1.127 },
  { at: 0.3342, turn: 315 / 1080, wobble: 4.83, lift: -9.92, scale: 1.140 },
  { at: 0.3733, turn: 360 / 1080, wobble: 4.33, lift: -10.67, scale: 1.151 },
  { at: 0.4125, turn: 405 / 1080, wobble: 3.54, lift: -11.25, scale: 1.159 },
  { at: 0.4517, turn: 450 / 1080, wobble: 2.5, lift: -11.67, scale: 1.165 },
  { at: 0.4908, turn: 495 / 1080, wobble: 1.29, lift: -11.92, scale: 1.169 },
  { at: 0.53, turn: 540 / 1080, wobble: 0, lift: -12, scale: 1.170 },
  { at: 0.5692, turn: 585 / 1080, wobble: -1.29, lift: -11.92, scale: 1.169 },
  { at: 0.6083, turn: 630 / 1080, wobble: -2.5, lift: -11.67, scale: 1.165 },
  { at: 0.6475, turn: 675 / 1080, wobble: -3.54, lift: -11.25, scale: 1.159 },
  { at: 0.6867, turn: 720 / 1080, wobble: -4.33, lift: -10.67, scale: 1.151 },
  { at: 0.7258, turn: 765 / 1080, wobble: -4.83, lift: -9.92, scale: 1.140 },
  { at: 0.765, turn: 810 / 1080, wobble: -5, lift: -9, scale: 1.127 },
  { at: 0.8042, turn: 855 / 1080, wobble: -4.83, lift: -7.92, scale: 1.112 },
  { at: 0.8433, turn: 900 / 1080, wobble: -4.33, lift: -6.67, scale: 1.094 },
  { at: 0.8825, turn: 945 / 1080, wobble: -3.54, lift: -5.25, scale: 1.074 },
  { at: 0.9217, turn: 990 / 1080, wobble: -2.5, lift: -3.67, scale: 1.052 },
  { at: 0.9608, turn: 1035 / 1080, wobble: -1.29, lift: -1.92, scale: 1.027 },
  { at: 1, turn: 1080 / 1080, wobble: 0, lift: 0, scale: 1.000 },
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
