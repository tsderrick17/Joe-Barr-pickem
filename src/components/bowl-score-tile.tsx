"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Feel = { pace: number; start: number; extra: number };

/**
 * One split-flap digit, like a mechanical stadium board. Each flip lets the
 * top flap fall (speeding up as it drops, darkening as it turns away) and the
 * next card's lower half land with a small bounce. The digit steps through
 * 0, 1, 2 ... 9 in order at its own pace; once told to land, it flips on
 * until it shows its target.
 *
 * The flips run on the browser's animation engine and write the numbers
 * straight into the page, so a whole board of them stays smooth on a phone:
 * React does not re-render on every flip.
 */
function FlapDigit({ target, landing, onLanded }: { target: number; landing: boolean; onLanded: () => void }) {
  const [feel] = useState<Feel>(() => ({ pace: 70 + Math.random() * 40, start: Math.floor(Math.random() * 10), extra: 1 + Math.floor(Math.random() * 3) }));
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
    const text = (el: HTMLSpanElement, value: number) => { (el.firstElementChild as HTMLElement).textContent = String(value); };
    let current = feel.start;
    let sinceLanding = 0;
    let stopped = false;
    let pending = 0;
    const running: Animation[] = [];

    const flip = () => {
      if (stopped) return;
      const next = (current + 1) % 10;
      const nearEnd = landingRef.current && sinceLanding >= feel.extra && (targetRef.current - next + 10) % 10 <= 1;
      // The last flip or two before stopping run a little slower, like the
      // mechanism catching.
      const duration = feel.pace * (nearEnd ? 1.7 : 0.9 + Math.random() * 0.2);
      text(foldEl, current);
      text(topEl, next);
      text(dropEl, next);
      foldEl.style.visibility = "visible";
      dropEl.style.visibility = "visible";
      const half = duration / 2;
      running.length = 0;
      running.push(foldEl.animate(
        [{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }],
        { duration: half, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" },
      ));
      running.push((foldEl.lastElementChild as HTMLElement).animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: half, easing: "ease-in", fill: "forwards" }));
      const landingFlap = dropEl.animate(
        [{ transform: "rotateX(90deg)" }, { transform: "rotateX(-8deg)", offset: 0.82 }, { transform: "rotateX(0deg)" }],
        { duration: half * 1.15, delay: half, easing: "cubic-bezier(.2,.6,.35,1)", fill: "forwards" },
      );
      running.push(landingFlap);
      running.push((dropEl.lastElementChild as HTMLElement).animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: half, delay: half, easing: "ease-out", fill: "forwards" }));
      landingFlap.onfinish = () => {
        if (stopped) return;
        text(bottomEl, next);
        dropEl.style.visibility = "hidden";
        foldEl.style.visibility = "hidden";
        current = next;
        if (landingRef.current) sinceLanding += 1;
        if (landingRef.current && sinceLanding >= feel.extra && current === targetRef.current) {
          stopped = true;
          landedRef.current();
          return;
        }
        pending = window.setTimeout(flip, Math.random() * 18);
      };
    };

    pending = window.setTimeout(flip, Math.random() * feel.pace);
    return () => {
      stopped = true;
      window.clearTimeout(pending);
      running.forEach((animation) => animation.cancel());
    };
  }, [feel]);

  return (
    <span aria-hidden="true" className="bowl-flap">
      <span className="bowl-flap-half is-top" ref={top}><span>{feel.start}</span></span>
      <span className="bowl-flap-half is-bottom" ref={bottom}><span>{feel.start}</span></span>
      <span className="bowl-flap-half is-top is-folding" ref={fold}><span>{feel.start}</span><i className="bowl-flap-shade" /></span>
      <span className="bowl-flap-half is-bottom is-dropping" ref={drop}><span>{feel.start}</span><i className="bowl-flap-shade" /></span>
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
