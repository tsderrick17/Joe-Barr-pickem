"use client";

import { useLayoutEffect } from "react";

/**
 * The loading football: the approved ball (ray-cast in 3D, football-stills/football-v17.html), pre-rendered as 108
 * motion-blurred frames of one turn (public/football-spin.webp, a 12 x 9 grid kept under the 4096 px an iPhone will draw at
 * full size), stepped through by CSS and tipped nose-up (no wobble by default). Nothing runs in JavaScript while it spins.
 * With reduced motion it is a still ball.
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
