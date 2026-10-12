"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const FRAMES = 90, COLUMNS = 10;

/**
 * The loading football: the approved ball (ray-cast in 3D, football-stills/football-v15.html), pre-rendered as 90 full-size
 * frames of one slow, smooth turn (public/football-spin.webp, a 10 x 9 grid kept under the 4096 px an iPhone will draw at full
 * size), tipped nose-up (no wobble by default). The frame is chosen here once per screen refresh and only written when it
 * changes: iPhone Safari glided a CSS-stepped sprite between frames, showing pieces of four at once. The turn takes
 * --football-spin-s (tunable in Commissioner Assets). With reduced motion it is a still ball.
 */
export default function FootballLoader({ label = "Loading" }: { label?: string }) {
  const ball = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ball.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, shown = -1, turns = 0, last = performance.now(), turnSeconds = 1.5;
    const readTurn = () => { turnSeconds = Math.max(0.1, parseFloat(getComputedStyle(el).getPropertyValue("--football-spin-s")) || 1.5); };
    readTurn();
    const tick = (now: number) => {
      // Count progress in turns, not time, so a new turn length takes over smoothly; and never jump after the tab was hidden.
      turns += Math.min(now - last, 100) / 1000 / turnSeconds;
      last = now;
      if (turns >= 1) { turns %= 1; readTurn(); }
      const frame = FRAMES - 1 - Math.floor(turns * FRAMES); // the sheet is played backwards, as rendered
      if (frame !== shown) {
        shown = frame;
        el.style.backgroundPosition = `calc(var(--football-w) * -${frame % COLUMNS}) calc(var(--football-h) * -${Math.floor(frame / COLUMNS)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div aria-live="polite" className="football-loader" role="status">
      <span aria-hidden="true" className="football-loader-tilt"><span className="football-loader-ball" ref={ball} /></span>
      <span className="football-loader-label">{label}</span>
    </div>
  );
}

/**
 * A whole loading screen: the football alone, centered on the page's own background. While it is up the page is held
 * exactly the window tall with its scrollbar track in place (see .is-loading-screen), so the ball never moves and the
 * scrollbar neither resizes as the page fills in underneath nor shifts the width when the page is revealed. */
export function FootballLoadingScreen({ background }: { background: string }) {
  useLayoutEffect(() => {
    document.documentElement.classList.add("is-loading-screen");
    return () => document.documentElement.classList.remove("is-loading-screen");
  }, []);
  return (
    <main aria-busy="true" className={`football-loading-screen football-loading-screen--page ${background}`}>
      <FootballLoader />
    </main>
  );
}
