"use client";

import { useEffect, useRef, useState } from "react";
import FootballLoader from "@/components/football-loader";

/**
 * Pull down to refresh, for the app added to a phone's home screen (a standalone window has no browser bar, so no refresh
 * button and no built-in pull). In a normal browser tab this does nothing and the browser keeps its own behavior.
 * Pulling down from the very top of the page drags the football into view; past the threshold, letting go reloads the page.
 */
const THRESHOLD = 60;
const MAX = 84;
const RESISTANCE = 0.6;

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

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef({ active: false, startY: 0, pull: 0, refreshing: false });

  useEffect(() => {
    if (!isInstalledApp()) return;
    document.documentElement.classList.add("has-pull-refresh");
    const state = gesture.current;
    const onStart = (event: TouchEvent) => {
      state.active = !state.refreshing && event.touches.length === 1 && window.scrollY <= 0 && !insideScrolledBox(event.target);
      state.startY = event.touches[0]?.clientY ?? 0;
      state.pull = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (!state.active) return;
      const distance = (event.touches[0]?.clientY ?? state.startY) - state.startY;
      if (window.scrollY > 0 || event.touches.length !== 1) { state.active = false; state.pull = 0; setPull(0); return; }
      if (distance <= 0) { state.pull = 0; setPull(0); return; }
      if (event.cancelable) event.preventDefault();
      const before = state.pull;
      state.pull = Math.min(MAX, distance * RESISTANCE);
      if (before < THRESHOLD && state.pull >= THRESHOLD) navigator.vibrate?.(10);   // one light tick where the phone supports it
      setPull(state.pull);
    };
    const onEnd = () => {
      if (!state.active) return;
      state.active = false;
      if (state.pull >= THRESHOLD) {
        state.refreshing = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        window.setTimeout(() => window.location.reload(), 250);
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

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div className="pull-refresh" data-ready={ready || refreshing ? "true" : "false"} style={{ opacity: Math.min(1, pull / THRESHOLD), transform: `translateY(${pull * 0.95}px)` }}>
      <FootballLoader label={refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"} />
    </div>
  );
}
