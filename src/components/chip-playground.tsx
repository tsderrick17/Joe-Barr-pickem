"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

/** A Raiders chip on the Operations desk to toss (click) or turn by hand (drag),
 *  for checking the chip from every angle. Nothing here touches pool data. */
export default function ChipPlayground() {
  const [toss, setToss] = useState(0);
  const [turn, setTurn] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);

  function down(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, startX: turn.x, startY: turn.y, moved: false };
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 4) return;
    if (!current.moved) setToss(0);
    current.moved = true;
    setTurn({ x: current.startX - dy * 1.2, y: current.startY + dx * 1.2 });
  }

  function up() {
    const current = drag.current;
    drag.current = null;
    if (current?.moved) return;
    setTurn({ x: 0, y: 0 });
    setToss((value) => value + 1);
  }

  return (
    <button
      aria-label="Test chip: click to flip, drag to turn"
      className="chip-playground"
      onPointerCancel={() => { drag.current = null; }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      style={{ "--playground-x": `${turn.x}deg`, "--playground-y": `${turn.y}deg` } as CSSProperties}
      title="Click to flip, drag to turn"
      type="button"
    >
      <SurvivorPokerChip abbreviation="LV" animate={toss > 0} key={toss} teamName="Las Vegas Raiders" tooltip="Click to flip, drag to turn" />
    </button>
  );
}
