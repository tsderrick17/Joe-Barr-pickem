"use client";

import { useEffect, useRef, useState } from "react";
import { FootballLoadingScreen } from "@/components/football-loader";
import PullChainScene from "@/components/pull-chain-scene";

/**
 * Pull down to refresh, for the app added to a phone's home screen (a standalone window has no browser bar, so no refresh
 * button and no built-in pull). In a normal browser tab this does nothing and the browser keeps its own behavior.
 *
 * The page is pulled down from the very top and the lead pole of a first-down chain is dragged out of the top edge of the header,
 * swinging down and stretching the chain as it comes. Far enough, and its rubber foot plants on the ground with a thud and the chain
 * snaps taut: that is the signal to release. Letting go reloads the page while the chain hums; letting go early lets the pole draw
 * back up. Everything is drawn inside the header and never below it.
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

/** Where the page starts, below the header: the loading football covers the page from here down and leaves the header as it is. */
function pageTop() {
  const bottoms = Array.from(document.querySelectorAll("nav")).map((element) => element.getBoundingClientRect()).filter((box) => box.height > 0).map((box) => box.bottom);
  return Math.round(Math.max(0, ...bottoms));
}

/** How tall the header at the very top is: the chain is drawn inside it and never below it. */
function headerHeight() {
  const nav = Array.from(document.querySelectorAll("nav")).find((element) => element.getBoundingClientRect().height > 0);
  const bottom = nav ? nav.getBoundingClientRect().bottom : 56;
  return Math.round(Math.min(96, Math.max(44, bottom)));
}

type Phase = "pulling" | "planted" | "refreshing";

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("pulling");
  const [height, setHeight] = useState(56);
  const [width, setWidth] = useState(390);
  const [coverTop, setCoverTop] = useState(0);
  const [plantedAt, setPlantedAt] = useState(0);
  const [now, setNow] = useState(0);
  const gesture = useRef({ active: false, startY: 0, pull: 0, phase: "pulling" as Phase });

  useEffect(() => {
    if (!isInstalledApp()) return;
    document.documentElement.classList.add("has-pull-refresh");
    const state = gesture.current;
    const onStart = (event: TouchEvent) => {
      state.active = state.phase !== "refreshing" && event.touches.length === 1 && window.scrollY <= 0 && !insideScrolledBox(event.target);
      state.startY = event.touches[0]?.clientY ?? 0;
      state.pull = 0;
      if (state.active) { state.phase = "pulling"; setPhase("pulling"); setHeight(headerHeight()); setWidth(document.documentElement.clientWidth); setCoverTop(pageTop()); }
    };
    const onMove = (event: TouchEvent) => {
      if (!state.active) return;
      const distance = (event.touches[0]?.clientY ?? state.startY) - state.startY;
      if (window.scrollY > 0 || event.touches.length !== 1) { state.active = false; state.pull = 0; setPull(0); return; }
      if (distance <= 0) { state.pull = 0; state.phase = "pulling"; setPhase("pulling"); setPull(0); return; }
      if (event.cancelable) event.preventDefault();
      state.pull = Math.min(MAX, distance * RESISTANCE);
      if (state.pull >= THRESHOLD && state.phase === "pulling") {
        state.phase = "planted";
        setPhase("planted");
        setPlantedAt(performance.now());
        navigator.vibrate?.(12);   // one light thud where the phone supports it
      } else if (state.pull < THRESHOLD - 8 && state.phase === "planted") {
        state.phase = "pulling";
        setPhase("pulling");
      }
      setPull(state.pull);
    };
    const onEnd = () => {
      if (!state.active) return;
      state.active = false;
      if (state.phase === "planted") {
        state.phase = "refreshing";
        setPhase("refreshing");
        window.setTimeout(() => window.location.reload(), 120);   // the football is up on the next frame; the page reloads right behind it
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

  // Once the foot has planted the chain keeps moving (the thud, then a hum), so the clock runs until the pole lifts or the page reloads.
  useEffect(() => {
    if (phase === "pulling") return;
    let frame = 0;
    const tick = (time: number) => { setNow(time); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  if (pull <= 0 && phase !== "refreshing") return null;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const since = phase === "pulling" || calm ? 0 : Math.max(0, now - plantedAt);   // ms since the foot planted
  const label = phase === "refreshing" ? "Refreshing" : phase === "planted" ? "Release to refresh" : "Pull to refresh";
  return (
    <>
      {phase === "refreshing" ? (
        <div className="pull-refresh-cover" style={{ top: coverTop }}>
          <FootballLoadingScreen background="bg-(color:--themed-bg-18) text-(color:--themed-text-18)" />
        </div>
      ) : null}
      <div aria-live="polite" className="pull-chain" data-phase={phase} role="status" style={{ height }}>
        <PullChainScene height={height} planted={phase !== "pulling"} progress={pull / THRESHOLD} since={since} width={width} />
        <span className="pull-chain-label">{label}</span>
      </div>
    </>
  );
}
