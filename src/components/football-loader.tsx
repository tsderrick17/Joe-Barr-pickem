"use client";

import { useLayoutEffect } from "react";

/**
 * The loading football: the approved ball (ray-cast in 3D, football-stills/football-v15.html), pre-rendered as 72 full-size frames of one slow, smooth turn (a 9 x 8 grid) (public/football-spin.webp, made
 * from the still renders in football-stills/), stepped through by CSS and tipped nose-up (no wobble by
 * default). Nothing runs in JavaScript while it spins. With reduced motion it is a still ball.
 */
export default function FootballLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-live="polite" className="football-loader" role="status">
      <span aria-hidden="true" className="football-loader-tilt"><span className="football-loader-ball" /></span>
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
