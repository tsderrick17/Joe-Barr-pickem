"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * A player's Bowl Pool win total as a two-digit flip tile, in the style of the
 * games-remaining counter. Until `settled`, each tile spins on its own: its
 * own pace, each digit turning independently, and it slows down before it
 * lands on the real total. Tiles land down the line, `landDelay` milliseconds
 * after `settled`, so each stops a beat after the one above it.
 */
export default function BowlScoreTile({ value, viewer, settled, landDelay = 0 }: { value: number; viewer: boolean; settled: boolean; landDelay?: number }) {
  const [landed, setLanded] = useState(false);
  const [digits, setDigits] = useState(() => [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)]);
  // Each tile draws its own temperament once.
  const [feel] = useState(() => ({ pace: 55 + Math.random() * 70, tensEvery: 2 + Math.floor(Math.random() * 3), flip: 0.22 + Math.random() * 0.2, land: Math.random() * 25 }));
  const slowing = useRef(false);

  useEffect(() => {
    if (!settled) return;
    const landAt = landDelay + feel.land;
    const slow = window.setTimeout(() => { slowing.current = true; }, Math.max(0, landAt - 320));
    const land = window.setTimeout(() => setLanded(true), landAt);
    return () => { window.clearTimeout(slow); window.clearTimeout(land); };
  }, [settled, landDelay, feel]);

  useEffect(() => {
    if (landed) return;
    let tick = 0;
    let timer = 0;
    const step = () => {
      tick += 1;
      setDigits((current) => [tick % feel.tensEvery === 0 ? Math.floor(Math.random() * 10) : current[0], Math.floor(Math.random() * 10)]);
      // Slow down as it comes in to land.
      timer = window.setTimeout(step, slowing.current ? feel.pace * 2.6 : feel.pace * (0.8 + Math.random() * 0.4));
    };
    timer = window.setTimeout(step, feel.pace * Math.random());
    return () => window.clearTimeout(timer);
  }, [landed, feel]);

  const total = Math.max(0, Math.min(99, value));
  const shown = landed ? [Math.floor(total / 10), total % 10] : digits;
  return (
    <span aria-label={`${value} wins`} className={`bowl-score-tile ${viewer ? "is-viewer" : ""} ${landed ? "is-landed" : "is-spinning"}`} data-settled={landed ? "true" : undefined} role="img" style={{ "--tile-flip": `${feel.flip}s` } as CSSProperties}>
      {shown.map((digit, index) => (
        <span aria-hidden="true" className="bowl-score-digit" key={`${index}-${digit}`}><span className="bowl-flip-digit-face">{digit}</span></span>
      ))}
    </span>
  );
}
