"use client";

import { useEffect, useState } from "react";

/**
 * True once every image on the page has loaded and decoded (or `limitMs` has passed), counted from the moment
 * `active` turns true. A loading screen holds until then, so logos never pop in after it has gone away.
 */
export function useImagesReady(active: boolean, limitMs = 2500) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const finish = () => { if (!cancelled) setReady(true); };
    const timer = window.setTimeout(finish, limitMs);
    const settle = (image: HTMLImageElement) => image.complete
      ? image.decode().catch(() => undefined)
      : new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); });
    // Wait a frame so images from the data that just arrived are in the page.
    const frame = window.requestAnimationFrame(() => {
      void Promise.all([...document.images].map(settle)).then(() => { window.clearTimeout(timer); finish(); });
    });
    return () => { cancelled = true; window.clearTimeout(timer); window.cancelAnimationFrame(frame); };
  }, [active, limitMs]);
  return ready;
}
