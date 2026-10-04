"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Feel = { pace: number; start: number; extra: number };

/** Graduate draws its zero with a dot in the middle; its capital O is the same shape without one. */
export const tileGlyph = (digit: number) => (digit === 0 ? "O" : String(digit));

// A falling flap speeds up like something dropping; a landing flap hits its
// stop, kicks back a little, and settles.
const FALL_EASING = "cubic-bezier(.55, .06, .68, .19)";

/**
 * One split-flap digit, like a mechanical stadium board. Each card is two
 * halves on a hinge across the middle. On every flip the current card's top
 * half swings down toward you on its hinge (in true perspective, so it
 * foreshortens), uncovering the next card's top half; as it passes edge-on,
 * the next card's lower half swings down after it, slaps onto its stop with a
 * small rebound, and covers the old lower half. Shading sells the depth: the
 * falling flap darkens as it turns away from the light, it casts a shadow
 * over the lower half it is about to cover, and the newly uncovered top half
 * starts in that shadow and brightens.
 *
 * The digit steps 0, 1, 2 ... 9 in order at its own pace; once told to land,
 * it flips on until it shows its target, the last few flips slowing as the
 * mechanism catches. The flips run on the browser's animation engine (only
 * transforms and opacity, which the graphics chip draws) and write the
 * numbers straight into the page, so React does not re-render on every flip.
 */
function FlapDigit({ target, landing, onLanded }: { target: number; landing: boolean; onLanded: () => void }) {
  const [feel] = useState<Feel>(() => ({ pace: 120 + Math.random() * 40, start: Math.floor(Math.random() * 10), extra: 2 + Math.floor(Math.random() * 3) }));
  const top = useRef<HTMLSpanElement | null>(null);
  const bottom = useRef<HTMLSpanElement | null>(null);
  const fold = useRef<HTMLSpanElement | null>(null);
  const drop = useRef<HTMLSpanElement | null>(null);
  const landingRef = useRef(landing);
  const targetRef = useRef(target);
  const landedRef = useRef(onLanded);

  useEffect(() => { landingRef.current = landing; }, [landing]);
  useEffect(() => { targetRef.current = target; landedRef.current = onLanded; }, [target, onLanded]);

  useEffect(() => {
    const parts = [top.current, bottom.current, fold.current, drop.current];
    if (parts.some((part) => !part)) return;
    const [topEl, bottomEl, foldEl, dropEl] = parts as HTMLSpanElement[];
    const text = (el: HTMLSpanElement, value: number) => { (el.firstElementChild as HTMLElement).textContent = tileGlyph(value); };
    const shade = (el: HTMLSpanElement) => el.lastElementChild as HTMLElement;
    let current = feel.start;
    let sinceLanding = 0;
    let stopped = false;
    let pending = 0;
    let running: Animation[] = [];

    const flip = () => {
      if (stopped) return;
      const next = (current + 1) % 10;
      const remaining = (targetRef.current - current + 10) % 10;
      const catching = landingRef.current && sinceLanding + 1 >= feel.extra && remaining <= 3;
      // The last few flips slow down progressively, like the drum catching.
      const duration = feel.pace * (catching ? 1 + (4 - remaining) * 0.35 : 1);
      const fall = duration * 0.5;
      const land = duration * 0.62;
      text(foldEl, current);
      text(topEl, next);
      text(dropEl, next);
      running = [
        foldEl.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }], { duration: fall, easing: FALL_EASING, fill: "forwards" }),
        shade(foldEl).animate([{ opacity: 0 }, { opacity: 0.6 }], { duration: fall, easing: FALL_EASING, fill: "forwards" }),
        shade(topEl).animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: fall + land * 0.4, easing: "ease-out", fill: "both" }),
        shade(bottomEl).animate([{ opacity: 0 }, { opacity: 0.35 }], { duration: fall + land * 0.6, easing: "ease-in", fill: "forwards" }),
        dropEl.animate([
          { transform: "rotateX(90deg)", easing: "cubic-bezier(.5, 0, .9, .6)" },
          { transform: "rotateX(0deg)", offset: 0.66, easing: "cubic-bezier(.2, .7, .4, 1)" },
          { transform: "rotateX(14deg)", offset: 0.82, easing: "ease-in" },
          { transform: "rotateX(0deg)" },
        ], { duration: land, delay: fall, fill: "both" }),
        shade(dropEl).animate([{ opacity: 0.55 }, { opacity: 0, offset: 0.66 }, { opacity: 0.12, offset: 0.82 }, { opacity: 0 }], { duration: land, delay: fall, fill: "both" }),
      ];
      const landed = running[4];
      landed.onfinish = () => {
        if (stopped) return;
        text(bottomEl, next);
        current = next;
        if (landingRef.current) sinceLanding += 1;
        if (landingRef.current && sinceLanding >= feel.extra && current === targetRef.current) {
          stopped = true;
          // Leave the faces clean: no shadows or flaps left mid-turn.
          running.forEach((animation) => animation.cancel());
          landedRef.current();
          return;
        }
        flip();
      };
    };

    pending = window.setTimeout(flip, Math.random() * feel.pace);
    return () => {
      stopped = true;
      window.clearTimeout(pending);
      running.forEach((animation) => animation.cancel());
    };
  }, [feel]);

  const half = (className: string, ref: typeof top) => <span className={`bowl-flap-half ${className}`} ref={ref}><span>{tileGlyph(feel.start)}</span><i className="bowl-flap-shade" /></span>;
  return (
    <span aria-hidden="true" className="bowl-flap is-moving">
      {half("is-top", top)}
      {half("is-bottom", bottom)}
      {half("is-top is-folding", fold)}
      {half("is-bottom is-dropping", drop)}
    </span>
  );
}

/** A still digit, for anyone with reduced motion turned on. */
function StillDigit({ digit }: { digit: number }) {
  return <span aria-hidden="true" className="bowl-flap"><span className="bowl-flap-half is-top"><span>{tileGlyph(digit)}</span></span><span className="bowl-flap-half is-bottom"><span>{tileGlyph(digit)}</span></span></span>;
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
