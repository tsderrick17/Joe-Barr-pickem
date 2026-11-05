"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HapticTap } from "@/components/haptic-tap";
import { haptic } from "@/lib/haptics-client";
import { BOARD_PACE, digitPace, nextFlip } from "@/lib/split-flap.js";

type Feel = { pace: number; start: number };

/** Graduate draws its zero with a dot in the middle; its capital O is the same shape without one. */
const tileGlyph = (digit: number) => (digit === 0 ? "O" : String(digit));

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
 * The digit steps 0, 1, 2 ... 9 in order at the board's pace; once told to
 * land, it flips forward only as far as its target, the last few flips slowing
 * as the mechanism catches (src/lib/split-flap.js). The flips run on the browser's animation engine (only
 * transforms and opacity, which the graphics chip draws) and write the
 * numbers straight into the page, so React does not re-render on every flip.
 */
function FlapDigit({ target, landing, onLanded, pace, start, minFlips, delay }: { target: number; landing: boolean; onLanded: () => void; pace: number; start?: number; minFlips: number; delay?: number }) {
  const [feel] = useState<Feel>(() => ({ pace: digitPace(pace, Math.random()), start: start ?? Math.floor(Math.random() * 10) }));
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

    const finish = () => {
      stopped = true;
      // Leave the faces clean: no shadows or flaps left mid-turn.
      running.forEach((animation) => animation.cancel());
      landedRef.current();
    };

    const flip = () => {
      if (stopped) return;
      const move = nextFlip({ current, target: targetRef.current, landing: landingRef.current, flipsSinceLanding: sinceLanding, minFlips, pace: feel.pace });
      if (move.stop) { finish(); return; }
      const { next, duration } = move;
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
        flip();
      };
    };

    pending = window.setTimeout(flip, delay ?? Math.random() * feel.pace);
    return () => {
      stopped = true;
      window.clearTimeout(pending);
      running.forEach((animation) => animation.cancel());
    };
  }, [feel, minFlips, delay]);

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
 * run on their own until `settled`; then, `landDelay` milliseconds later, each
 * flips forward to the real total, so the rows stop down the line. Once landed,
 * a tap flips the tile once round the drum and back to the same number, just for
 * fun (a light tick; never with reduced motion).
 */
export default function BowlScoreTile({ value, settled, landDelay = 0, large = false, animate = true, pace = BOARD_PACE }: { value: number; settled: boolean; landDelay?: number; large?: boolean; animate?: boolean; /** ms per flip for the whole board */ pace?: number }) {
  const total = Math.max(0, Math.min(99, value));
  const digits = [Math.floor(total / 10), total % 10];
  const [landing, setLanding] = useState(false);
  const [landedDigits, setLandedDigits] = useState(0);
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [round, setRound] = useState(0);
  const still = reduced || (!animate && round === 0);
  const markLanded = useCallback(() => setLandedDigits((count) => count + 1), []);

  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => setLanding(true), landDelay);
    return () => window.clearTimeout(timer);
  }, [settled, landDelay]);

  const landed = still ? settled : landedDigits >= 2;
  const faces = digits.map((digit, index) => (still
    ? <StillDigit digit={digit} key={index} />
    : round > 0
      // Flip again: both digits start from their number and make one full turn, the second a beat behind.
      ? <FlapDigit delay={index * pace * 0.3} key={`${round}-${index}`} landing minFlips={1} onLanded={markLanded} pace={pace} start={digit} target={digit} />
      : <FlapDigit key={index} landing={landing} minFlips={0} onLanded={markLanded} pace={pace} target={digit} />));
  const flipAgain = () => {
    haptic("tick");
    setLandedDigits(0);
    setRound((count) => count + 1);
  };
  return (
    <span aria-label={`${value} wins`} className={`bowl-score-tile ${large ? "is-large" : ""} ${landed ? "is-landed" : "is-spinning"}`} data-settled={landed ? "true" : undefined} role="img">
      {reduced ? faces : <button aria-hidden="true" className="bowl-score-flip relative" disabled={!landed || !settled} onClick={flipAgain} tabIndex={-1} type="button">{faces}<HapticTap /></button>}
    </span>
  );
}
