"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * One split-flap digit, like a mechanical stadium board: each step drops the
 * top flap to reveal the next number (0, 1, 2 ... 9, 0), at this digit's own
 * pace. Once told to land, it keeps flipping until it reaches its target.
 */
function FlapDigit({ target, landing, onLanded }: { target: number; landing: boolean; onLanded: () => void }) {
  // Each digit has its own mechanism: a pace, a starting card, and a few more
  // flips it must make after the signal to land.
  const [feel] = useState(() => ({ pace: 55 + Math.random() * 40, start: Math.floor(Math.random() * 10), extra: 1 + Math.floor(Math.random() * 3) }));
  const [face, setFace] = useState(() => ({ current: feel.start, previous: feel.start, flip: 0, sinceLanding: 0 }));
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (landing && face.sinceLanding >= feel.extra && face.current === target) {
      done.current = true;
      onLanded();
      return;
    }
    const timer = window.setTimeout(() => {
      setFace((now) => ({ current: (now.current + 1) % 10, previous: now.current, flip: now.flip + 1, sinceLanding: now.sinceLanding + (landing ? 1 : 0) }));
    }, feel.pace * (0.85 + Math.random() * 0.3));
    return () => window.clearTimeout(timer);
  }, [face, landing, target, feel, onLanded]);

  return (
    <span aria-hidden="true" className="bowl-flap" style={{ "--flap-ms": `${Math.round(feel.pace * 0.9)}ms` } as CSSProperties}>
      <span className="bowl-flap-half is-top"><span>{face.current}</span></span>
      <span className="bowl-flap-half is-bottom"><span>{face.previous}</span></span>
      {face.flip > 0 ? <>
        <span className="bowl-flap-half is-top is-folding" key={`fold-${face.flip}`}><span>{face.previous}</span></span>
        <span className="bowl-flap-half is-bottom is-dropping" key={`drop-${face.flip}`}><span>{face.current}</span></span>
      </> : null}
    </span>
  );
}

/** A still digit, for anyone with reduced motion turned on. */
function StillDigit({ digit }: { digit: number }) {
  return <span aria-hidden="true" className="bowl-flap"><span className="bowl-flap-half is-top"><span>{digit}</span></span><span className="bowl-flap-half is-bottom"><span>{digit}</span></span></span>;
}

/**
 * A player's Bowl Pool win total as a two-digit split-flap tile. The digits
 * run on their own until `settled`; then, `landDelay` milliseconds later, they
 * flip on until they reach the real total, so the rows stop down the line.
 */
export default function BowlScoreTile({ value, viewer, settled, landDelay = 0 }: { value: number; viewer: boolean; settled: boolean; landDelay?: number }) {
  const total = Math.max(0, Math.min(99, value));
  const digits = [Math.floor(total / 10), total % 10];
  const [landing, setLanding] = useState(false);
  const [landedDigits, setLandedDigits] = useState(0);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const markLanded = useCallback(() => setLandedDigits((count) => count + 1), []);

  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => setLanding(true), landDelay);
    return () => window.clearTimeout(timer);
  }, [settled, landDelay]);

  const landed = still ? settled : landedDigits >= 2;
  return (
    <span aria-label={`${value} wins`} className={`bowl-score-tile ${viewer ? "is-viewer" : ""} ${landed ? "is-landed" : "is-spinning"}`} data-settled={landed ? "true" : undefined} role="img">
      {digits.map((digit, index) => (still
        ? <StillDigit digit={digit} key={index} />
        : <FlapDigit key={index} landing={landing} onLanded={markLanded} target={digit} />))}
    </span>
  );
}
