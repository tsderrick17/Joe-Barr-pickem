"use client";

import { useEffect, useState, type ReactNode } from "react";

type Phase = "closed" | "opening" | "expanding" | "open" | "closing";

const SLIDE_MS = 340;

/**
 * Slides its content open and shut. Closed content is not kept on the page, so
 * a hidden table costs nothing; opening mounts it collapsed and lets it grow to
 * its full height, and closing shrinks it away before removing it. Content that
 * starts open appears at once, with no slide.
 */
export default function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");

  // Follow the `open` prop (adjusting state while rendering, as React allows).
  if (open && (phase === "closed" || phase === "closing")) setPhase(phase === "closing" ? "expanding" : "opening");
  if (!open && (phase === "open" || phase === "expanding" || phase === "opening")) setPhase("closing");

  useEffect(() => {
    if (phase === "opening") {
      // Let the collapsed content paint once so the growth has somewhere to start.
      let second = 0;
      const first = window.requestAnimationFrame(() => { second = window.requestAnimationFrame(() => setPhase("expanding")); });
      return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
    }
    if (phase === "expanding") {
      const timer = window.setTimeout(() => setPhase("open"), SLIDE_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === "closing") {
      const timer = window.setTimeout(() => setPhase("closed"), SLIDE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  if (phase === "closed") return null;
  return (
    <div className="collapse" data-open={phase === "expanding" || phase === "open" ? "true" : "false"} data-settled={phase === "open" ? "true" : undefined}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}
