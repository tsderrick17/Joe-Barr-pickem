"use client";

import { useEffect, useState } from "react";

/**
 * A player's Bowl Pool win total as a two-digit flip tile, in the style of the
 * games-remaining counter. Until `settled`, the digits spin through random
 * numbers; then they land on the real total, `landDelay` milliseconds later
 * so the rows land in a quick cascade.
 */
export default function BowlScoreTile({ value, viewer, settled, landDelay = 0 }: { value: number; viewer: boolean; settled: boolean; landDelay?: number }) {
  const [landed, setLanded] = useState(false);
  const [spin, setSpin] = useState(() => Math.floor(Math.random() * 100));

  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => setLanded(true), landDelay);
    return () => window.clearTimeout(timer);
  }, [settled, landDelay]);

  useEffect(() => {
    if (landed) return;
    const timer = window.setInterval(() => setSpin(Math.floor(Math.random() * 100)), 80);
    return () => window.clearInterval(timer);
  }, [landed]);

  const shown = landed ? Math.max(0, Math.min(99, value)) : spin;
  return (
    <span aria-label={`${value} wins`} className={`bowl-score-tile ${viewer ? "is-viewer" : ""} ${landed ? "is-landed" : "is-spinning"}`} data-settled={landed ? "true" : undefined} role="img">
      {String(shown).padStart(2, "0").split("").map((digit, index) => (
        <span aria-hidden="true" className="bowl-score-digit" key={`${index}-${digit}`}><span className="bowl-flip-digit-face">{digit}</span></span>
      ))}
    </span>
  );
}
