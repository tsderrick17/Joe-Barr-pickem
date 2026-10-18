"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pull down to refresh, for the app added to a phone's home screen (a standalone window has no browser bar, so no refresh
 * button and no built-in pull). In a normal browser tab this does nothing and the browser keeps its own behavior.
 *
 * The page is pulled down from the very top and a drop of water swells from the top edge of the header, stretching on a thin
 * neck. Far enough, and the drop lets go and falls: that is the signal to release. Letting go reloads the page; letting go
 * early lets the water draw back up. The drop never leaves the header.
 */
const THRESHOLD = 60;
const MAX = 84;
const RESISTANCE = 0.6;
const WIDTH = 120;

function isInstalledApp() {
  return (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/** True when the touch began inside something that is itself scrolled down (a menu, a table), so that scroll wins. */
function insideScrolledBox(target: EventTarget | null) {
  for (let node = target instanceof Element ? target : null; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return false;
}

/** How tall the header at the very top is: the drop is drawn inside it and never below it. */
function headerHeight() {
  const nav = Array.from(document.querySelectorAll("nav")).find((element) => element.getBoundingClientRect().height > 0);
  const bottom = nav ? nav.getBoundingClientRect().bottom : 56;
  return Math.round(Math.min(96, Math.max(44, bottom)));
}

type Phase = "pulling" | "dropped" | "refreshing";

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("pulling");
  const [height, setHeight] = useState(56);
  const gesture = useRef({ active: false, startY: 0, pull: 0, phase: "pulling" as Phase });

  useEffect(() => {
    if (!isInstalledApp()) return;
    document.documentElement.classList.add("has-pull-refresh");
    const state = gesture.current;
    const onStart = (event: TouchEvent) => {
      state.active = state.phase !== "refreshing" && event.touches.length === 1 && window.scrollY <= 0 && !insideScrolledBox(event.target);
      state.startY = event.touches[0]?.clientY ?? 0;
      state.pull = 0;
      if (state.active) { state.phase = "pulling"; setPhase("pulling"); setHeight(headerHeight()); }
    };
    const onMove = (event: TouchEvent) => {
      if (!state.active) return;
      const distance = (event.touches[0]?.clientY ?? state.startY) - state.startY;
      if (window.scrollY > 0 || event.touches.length !== 1) { state.active = false; state.pull = 0; setPull(0); return; }
      if (distance <= 0) { state.pull = 0; state.phase = "pulling"; setPhase("pulling"); setPull(0); return; }
      if (event.cancelable) event.preventDefault();
      state.pull = Math.min(MAX, distance * RESISTANCE);
      if (state.pull >= THRESHOLD && state.phase === "pulling") {
        state.phase = "dropped";
        setPhase("dropped");
        navigator.vibrate?.(12);   // one light tick where the phone supports it
      } else if (state.pull < THRESHOLD - 8 && state.phase === "dropped") {
        state.phase = "pulling";
        setPhase("pulling");
      }
      setPull(state.pull);
    };
    const onEnd = () => {
      if (!state.active) return;
      state.active = false;
      if (state.phase === "dropped") {
        state.phase = "refreshing";
        setPhase("refreshing");
        window.setTimeout(() => window.location.reload(), 900);
      } else {
        state.pull = 0;
        setPull(0);
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.documentElement.classList.remove("has-pull-refresh");
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (pull <= 0 && phase !== "refreshing") return null;
  // The drop is a bulb on a neck. As the pull grows the bulb sinks and swells and the neck thins; once it lets go the neck
  // is a short stub at the top edge and a separate drop falls to the foot of the header.
  const progress = Math.min(1, pull / THRESHOLD);
  const cx = WIDTH / 2;
  const radius = 4 + 7 * progress;
  const bulbY = phase === "pulling" ? 4 + (height - 16 - radius) * progress : 0;
  const neck = 13 - 9 * progress;
  const hanging = phase === "pulling"
    ? `M ${cx - neck} 0 C ${cx - neck} ${bulbY * 0.55}, ${cx - radius} ${bulbY * 0.5}, ${cx - radius} ${bulbY} A ${radius} ${radius} 0 0 0 ${cx + radius} ${bulbY} C ${cx + radius} ${bulbY * 0.5}, ${cx + neck} ${bulbY * 0.55}, ${cx + neck} 0 Z`
    : `M ${cx - 9} 0 C ${cx - 7} 5, ${cx - 6} 8, ${cx} 9 C ${cx + 6} 8, ${cx + 7} 5, ${cx + 9} 0 Z`;
  const label = phase === "refreshing" ? "Refreshing" : phase === "dropped" ? "Release to refresh" : "Pull to refresh";
  return (
    <div aria-live="polite" className="pull-drip" data-phase={phase} role="status" style={{ height }}>
      <span className="pull-drip-line" style={{ opacity: progress }} />
      <svg aria-hidden="true" height={height} viewBox={`0 0 ${WIDTH} ${height}`} width={WIDTH}>
        <path className="pull-drip-water" d={hanging} />
        {phase !== "pulling" ? <circle className="pull-drip-fall" cx={cx} cy={9} r={6} style={{ "--drip-fall": `${height - 24}px` } as React.CSSProperties} /> : null}
        {phase !== "pulling" ? <ellipse className="pull-drip-ripple" cx={cx} cy={height - 4} rx={4} ry={1.4} /> : null}
      </svg>
      <span className="pull-drip-label">{label}</span>
    </div>
  );
}
