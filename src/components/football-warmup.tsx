"use client";

import { useEffect } from "react";

/**
 * Fetches the loading football's frames (public/football-spin.webp, 633 KB) once the page's own code has started, so
 * the ball is ready for the next loading screen. Preloading it from <head> made it compete with the page's code for a
 * slow phone's connection, delaying every page's first data read. The browser keeps the picture for a day.
 */
export default function FootballWarmup() {
  useEffect(() => {
    const warm = () => { const image = new Image(); image.decoding = "async"; image.src = "/football-spin.webp"; };
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1500));
    const handle = idle(warm);
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(handle);
  }, []);
  return null;
}
