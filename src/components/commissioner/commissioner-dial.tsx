"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import {
  SPOKES, SPOKE_COUNT, dialGeometry, dialPlace, dragPosition, nearestTurn, releaseTarget, swingAt, wrap,
} from "@/lib/commissioner-wheel.js";
import { haptic } from "@/lib/haptics-client";
import { useCommissionerStatus } from "@/components/commissioner/commissioner-status";
import { Medallion, STATE_WORDS, type SpokeState } from "@/components/commissioner/wheel-parts";
import { WheelIcon } from "@/components/commissioner/wheel-icons";

const RADIUS = 380;
const HINT_KEY = "commissioner-dial-hint";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const readHint = () => { try { return Number(window.localStorage.getItem(HINT_KEY)) || 0; } catch { return 0; } };
const writeHint = (value: number) => { try { window.localStorage.setItem(HINT_KEY, String(value)); } catch { /* private window: no hint memory */ } };

type Drag = { id: number; x: number; start: number; moved: boolean; nearest: number; cancel: boolean; velocity: number; lastX: number; lastT: number; tapped: number | null };

/**
 * The curved dial along the bottom of every Commissioner page: the current page in the middle, its neighbours either side on an arc.
 * Drag it and let go to open the page in the middle; slide up off it before letting go to cancel; tap a neighbour to open it.
 * On a computer the arrow buttons and the keyboard's arrow keys turn it one page. The Wheel button goes back to the wheel.
 */
export default function CommissionerDial({ current }: { current: number }) {
  const router = useRouter();
  const { spokes } = useCommissionerStatus();
  const navRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const ticksRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const position = useRef<number | null>(null);
  const frame = useRef(0);
  const drag = useRef<Drag | null>(null);
  const hint = useRef(false);

  const label = useCallback((name: string, note = "") => {
    if (labelRef.current) labelRef.current.innerHTML = "";
    const strong = document.createElement("span");
    strong.textContent = name;
    labelRef.current?.append(strong);
    if (note) {
      const small = document.createElement("small");
      small.textContent = note;
      labelRef.current?.append(small);
    }
  }, []);

  const layout = useCallback((pos: number, words?: [string, string?]) => {
    position.current = pos;
    const geometry = { ...dialGeometry(window.innerWidth), radius: RADIUS };
    const nearest = wrap(Math.round(pos));
    [...(trackRef.current?.children ?? [])].forEach((element, index) => {
      const place = dialPlace(index, pos, geometry);
      const button = element as HTMLElement;
      button.style.transform = `translate(${place.x}px, ${place.y}px) scale(${place.scale})`;
      button.style.opacity = String(place.opacity);
      button.style.pointerEvents = place.reachable ? "auto" : "none";
      button.classList.toggle("is-centre", index === nearest);
      button.tabIndex = index === current || !place.reachable ? -1 : 0;
    });
    if (ticksRef.current) ticksRef.current.style.transform = `rotate(${(-pos * geometry.gap / RADIUS) * 180 / Math.PI}deg)`;
    if (words) label(...words);
    else label(SPOKES[nearest].name, hint.current ? "drag to turn" : "");
  }, [current, label]);

  const swingTo = useCallback((target: number) => {
    cancelAnimationFrame(frame.current);
    const from = nearestTurn(position.current ?? target + 0.35, target);
    if (Math.abs(from - target) < 0.001 || reducedMotion()) { layout(target); return; }
    const started = performance.now();
    const step = (now: number) => {
      const seconds = (now - started) / 1000;
      layout(swingAt(target, from, seconds));
      if (seconds < 1.4) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [layout]);

  const go = useCallback((index: number) => {
    const target = wrap(index);
    if (target === current) { swingTo(current); return; }
    swingTo(target);
    router.push(SPOKES[target].href);
  }, [current, router, swingTo]);

  // A new page: settle the dial on it, and show the "drag to turn" hint the first three times.
  useEffect(() => {
    swingTo(current);
    const seen = readHint();
    if (seen >= 3) return;
    writeHint(seen + 1);
    hint.current = true;
    const timer = window.setTimeout(() => { hint.current = false; if (!drag.current) layout(position.current ?? current); }, 4000);
    return () => window.clearTimeout(timer);
  }, [current, layout, swingTo]);

  useEffect(() => {
    const resize = () => layout(position.current ?? current);
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(frame.current); };
  }, [current, layout]);

  // The keyboard's arrow keys turn the dial, unless the Commissioner is typing or working a control that uses them.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=slider], [role=tablist], dialog[open]")) return;
      go(current + (event.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [current, go]);

  useEffect(() => {
    SPOKES.forEach((spoke, index) => { if (Math.abs(wrap(index - current + SPOKE_COUNT / 2) - SPOKE_COUNT / 2) <= 2) router.prefetch(spoke.href); });
  }, [current, router]);

  function pointerDown(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest(".cw-dial-home, .cw-dial-arrow")) return;
    cancelAnimationFrame(frame.current);
    const tapped = (event.target as HTMLElement).closest<HTMLElement>(".cw-dk");
    drag.current = { id: event.pointerId, x: event.clientX, start: position.current ?? current, moved: false, nearest: current, cancel: false, velocity: 0, lastX: event.clientX, lastT: event.timeStamp, tapped: tapped ? Number(tapped.dataset.index) : null };
    try { navRef.current?.setPointerCapture(event.pointerId); } catch { /* the pointer already left */ }
    navRef.current?.classList.add("is-dragging");
  }

  function pointerMove(event: React.PointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    const dx = event.clientX - state.x;
    if (Math.abs(dx) > 6) state.moved = true;
    if (!state.moved) return;
    state.velocity = (event.clientX - state.lastX) / ((event.timeStamp - state.lastT) || 1);
    state.lastX = event.clientX;
    state.lastT = event.timeStamp;
    if (hint.current) { hint.current = false; writeHint(3); }
    const pos = dragPosition(state.start, dx, dialGeometry(window.innerWidth).gap);
    const nearest = wrap(Math.round(pos));
    state.cancel = event.clientY < (navRef.current?.getBoundingClientRect().top ?? 0) - 24;
    navRef.current?.classList.toggle("is-cancel", state.cancel);
    if (nearest !== state.nearest) { state.nearest = nearest; haptic("lightTick"); }
    layout(pos, state.cancel ? ["Let go to cancel"] : [SPOKES[nearest].name, nearest === current ? "you are here" : "let go to open"]);
  }

  function pointerEnd(event: React.PointerEvent<HTMLElement>, cancelled: boolean) {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;
    navRef.current?.classList.remove("is-dragging", "is-cancel");
    if (!state.moved && state.tapped !== null && !cancelled) { haptic("tick"); go(state.tapped); return; }
    go(releaseTarget({ current, nearest: state.nearest, moved: state.moved, velocity: state.velocity, cancelled: cancelled || state.cancel }));
  }

  const previous = SPOKES[wrap(current - 1)], next = SPOKES[wrap(current + 1)];
  return <nav
    aria-label="Commissioner pages"
    className="cw-dial"
    onPointerCancel={(event) => pointerEnd(event, true)}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={(event) => pointerEnd(event, false)}
    ref={navRef}
  >
    <div aria-hidden="true" className="cw-rail is-ticks" ref={ticksRef} />
    <div aria-hidden="true" className="cw-rail" />
    <div aria-hidden="true" className="cw-socket" />
    <div className="cw-dial-track" ref={trackRef}>
      {SPOKES.map((spoke, index) => {
        const status = spokes[spoke.key] as { state: SpokeState; count: number };
        return <button
          aria-current={index === current ? "page" : undefined}
          aria-label={`${spoke.name}: ${STATE_WORDS[status.state]}`}
          className="cw-dk"
          data-index={index}
          key={spoke.key}
          onClick={(event) => { if (event.detail === 0) go(index); }}
          type="button"
        >
          <Medallion count={status.count} icon={spoke.icon} state={status.state} />
        </button>;
      })}
    </div>
    <div aria-hidden="true" className="cw-dial-label" ref={labelRef} />
    <Link aria-label="Back to the wheel" className="cw-dial-home" href="/admin"><WheelIcon name="wheel" /><small>Wheel</small></Link>
    <Link aria-label={`Previous page: ${previous.name}`} className="cw-dial-arrow is-left" href={previous.href}><WheelIcon name="left" /></Link>
    <Link aria-label={`Next page: ${next.name}`} className="cw-dial-arrow is-right" href={next.href}><WheelIcon name="right" /></Link>
  </nav>;
}
