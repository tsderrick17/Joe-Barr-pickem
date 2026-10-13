"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const FRAMES = 90, COLUMNS = 10, ROWS = 9;

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
    let raf = 0, shown = -1, turns = 0, last = -1, turnSeconds = 1.5;
    const readTurn = () => { turnSeconds = Math.max(0.1, parseFloat(getComputedStyle(el).getPropertyValue("--football-spin-s")) || 1.5); };
    readTurn();
    // An empty, endless animation that marks the spin as running: anything that stops page animations (a screenshot tool,
    // for one) stops it, and the ball then rests on the sheet's first frame, as it would with a CSS animation.
    const running = el.animate([], { duration: 1000, iterations: Infinity });
    const tick = (now: number) => {
      if (running.playState !== "running") { el.style.backgroundPosition = ""; return; }
      // Count progress in turns, not time, so a new turn length takes over smoothly; and never jump after the tab was hidden.
      // The first refresh starts a quarter of a frame in, so refreshes land well inside a frame, never on the line between two:
      // at 60 Hz each refresh then shows the next frame, at 120 Hz each frame holds for exactly two, with no skips or repeats.
      // A refresh that is almost exactly one frame (60 Hz) or half a frame (120 Hz) counts as exactly that, so small wobbles in
      // the screen's timing never let the count drift onto a line.
      if (last < 0) turns = 0.25 / FRAMES;
      else {
        let frames = (Math.min(now - last, 100) / 1000 / turnSeconds) * FRAMES;
        const nearest = Math.round(frames * 2) / 2;
        if (nearest > 0 && Math.abs(frames - nearest) < 0.15) frames = nearest;
        turns += frames / FRAMES;
      }
      last = now;
      if (turns >= 1) { turns %= 1; readTurn(); }
      const frame = FRAMES - 1 - Math.floor(turns * FRAMES); // the sheet is played backwards, as rendered
      if (frame !== shown) {
        shown = frame;
        // Percentages place a cell exactly: 0% is the first column or row, 100% the last.
        el.style.backgroundPosition = `${((frame % COLUMNS) / (COLUMNS - 1)) * 100}% ${(Math.floor(frame / COLUMNS) / (ROWS - 1)) * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); running.cancel(); };
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
    // Start at the top, header in view, even if the browser restored a scrolled position.
    window.scrollTo(0, 0);
    return () => document.documentElement.classList.remove("is-loading-screen");
  }, []);
  return (
    <main aria-busy="true" className={`football-loading-screen football-loading-screen--page ${background}`}>
      <FootballLoader />
    </main>
  );
}
