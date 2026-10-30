"use client";

import { useEffect, useRef, useState } from "react";
import { FootballLoadingScreen } from "@/components/football-loader";
import PullChainScene from "@/components/pull-chain-scene";
import { PUFF_AT, pullStages, STRETCH_END } from "@/lib/pull-chain.js";
import { haptic } from "@/lib/haptics-client";
import { pullNotch } from "@/lib/haptics.js";

/**
 * Pull down to refresh, for the app added to a phone's home screen (a standalone window has no browser bar, so no refresh
 * button and no built-in pull). In a normal browser tab this does nothing and the browser keeps its own behavior.
 *
 * The page is pulled down from the very top and your finger drives a first-down scene in the header. First the lead pole comes down foot first
 * is drawn out with the chain slack until it is stretched, then drops, straightening as it lowers, and its foot lands beside the ball in a puff of dust (the measurement, `PUFF_AT` of the way). Then
 * the down counter in the distance slides from 4 to 1, following the finger; when it has fully turned to 1 there is a light buzz (where the phone has
 * one) and that is the signal to release. Letting go covers the page with the spinning loading football at once and reloads it right behind;
 * letting go early draws everything back. Everything is drawn inside the header and never below it.
 */
const THRESHOLD = 76;
const MAX = 98;
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
  const [landedAt, setLandedAt] = useState<number | null>(null);   // when the foot landed (the puff), or null while the pole is still coming down
  const [stretchedAt, setStretchedAt] = useState<number | null>(null);   // when the chain came fully taut (its one slight boing), or null while it is slack
  const [now, setNow] = useState(0);
  const gesture = useRef({ active: false, startY: 0, pull: 0, phase: "pulling" as Phase, lastTouch: 0, landed: false, stretched: false, notch: 0 });

  useEffect(() => {
    if (!isInstalledApp()) return;
    document.documentElement.classList.add("has-pull-refresh");
    const state = gesture.current;
    // However a gesture ends (a lost touchend, a reload that never happens, the page coming back from the back/forward cache), the chain goes away.
    const reset = () => { state.active = false; state.pull = 0; state.phase = "pulling"; state.landed = false; state.stretched = false; state.notch = 0; setPull(0); setPhase("pulling"); setLandedAt(null); setStretchedAt(null); };
    const onStart = (event: TouchEvent) => {
      state.lastTouch = Date.now();
      state.active = state.phase !== "refreshing" && event.touches.length === 1 && window.scrollY <= 0 && !insideScrolledBox(event.target);
      state.startY = event.touches[0]?.clientY ?? 0;
      state.pull = 0;
      if (state.active) { state.phase = "pulling"; state.landed = false; state.stretched = false; state.notch = 0; setLandedAt(null); setStretchedAt(null); setPhase("pulling"); setHeight(headerHeight()); setWidth(document.documentElement.clientWidth); setCoverTop(pageTop()); }
    };
    const onMove = (event: TouchEvent) => {
      if (!state.active) return;
      state.lastTouch = Date.now();
      const distance = (event.touches[0]?.clientY ?? state.startY) - state.startY;
      if (window.scrollY > 0 || event.touches.length !== 1) { reset(); return; }
      if (distance <= 0) { state.pull = 0; state.phase = "pulling"; setPhase("pulling"); setPull(0); return; }
      if (event.cancelable) event.preventDefault();
      state.pull = Math.min(MAX, distance * RESISTANCE);
      const progress = state.pull / THRESHOLD;
      // the foot lands (and dust puffs) at PUFF_AT of the way; pulling back up lifts it again
      // the chain comes fully taut partway through the descent; pulling back slackens it again
      const tautAt = PUFF_AT * STRETCH_END;
      if (progress >= tautAt && !state.stretched) { state.stretched = true; setStretchedAt(performance.now()); }
      else if (progress < tautAt - 0.04 && state.stretched) { state.stretched = false; setStretchedAt(null); }
      if (progress >= PUFF_AT && !state.landed) { state.landed = true; setLandedAt(performance.now()); }
      else if (progress < PUFF_AT - 0.04 && state.landed) { state.landed = false; setLandedAt(null); }
      // a notch under the finger each time the down counter drops a down (4 to 3, 3 to 2); pulling back up and down again notches again
      const notch = pullNotch(pullStages(progress).counter);
      if (notch > state.notch && notch < 3) haptic("ratchet");
      state.notch = notch;
      // the counter has fully turned to 1: a firmer buzz, and this is the signal to release
      if (progress >= 1 && state.phase === "pulling") {
        state.phase = "planted";
        setPhase("planted");
        haptic("lockIn");
      } else if (progress < 0.96 && state.phase === "planted") {
        state.phase = "pulling";
        setPhase("pulling");
      }
      setPull(state.pull);
    };
    const onEnd = () => {
      state.lastTouch = Date.now();
      if (state.phase === "refreshing") return;
      if (state.active && state.phase === "planted") {
        state.active = false;
        state.phase = "refreshing";
        setPhase("refreshing");
        window.setTimeout(() => window.location.reload(), 120);   // the football is up on the next frame; the page reloads right behind it
        window.setTimeout(() => { if (document.visibilityState === "visible") reset(); }, 6000);   // a reload that never came must not leave the football up
      } else reset();
    };
    // a finger that was lifted without the page hearing of it: once nothing has touched the screen for a moment, the chain goes
    const watchdog = window.setInterval(() => { if (state.phase !== "refreshing" && (state.pull > 0 || state.phase === "planted") && Date.now() - state.lastTouch > (state.active ? 4000 : 1500)) reset(); }, 500);
    const onShow = () => reset();
    window.addEventListener("pageshow", onShow);
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
      window.removeEventListener("pageshow", onShow);
      window.clearInterval(watchdog);
    };
  }, []);

  // Once the foot has landed the pole swings once past upright and settles, so the clock runs until the pole lifts or the page reloads.
  useEffect(() => {
    if (landedAt === null && stretchedAt === null) return;
    let frame = 0;
    const tick = (time: number) => { setNow(time); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [landedAt, stretchedAt]);

  if (pull <= 0 && phase !== "refreshing") return null;
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const since = landedAt === null || calm ? 0 : Math.max(0, now - landedAt);   // ms since the foot landed
  const label = phase === "refreshing" ? "Refreshing" : phase === "planted" ? "Release to refresh" : "Pull to refresh";
  return (
    <>
      {phase === "refreshing" ? (
        <div className="pull-refresh-cover" style={{ top: coverTop }}>
          <FootballLoadingScreen background="bg-(color:--themed-bg-18) text-(color:--themed-text-18)" />
        </div>
      ) : null}
      <div aria-live="polite" className="pull-chain" data-phase={phase} role="status" style={{ height }}>
        <PullChainScene height={height} landed={landedAt !== null} progress={pull / THRESHOLD} since={since} stretchedSince={stretchedAt === null || calm ? null : Math.max(0, now - stretchedAt)} width={width} />
        <span className="pull-chain-label">{label}</span>
      </div>
    </>
  );
}
