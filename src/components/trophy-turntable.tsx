"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import TrophyBanner from "@/components/trophy-banner";
import { championRoll } from "@/lib/trophy-roll.js";
import { loadOrder } from "@/lib/trophy-turn.js";
import { HapticTap } from "@/components/haptic-tap";
import { haptic } from "@/lib/haptics-client";

/**
 * The three trophies on a mahogany table that turns. The table is a set of pictures, one for every few degrees of a full turn (rendered once, see
 * tools/trophy-render). They are fetched and decoded in the background and drawn onto a canvas, so a spin never waits on an image (swapping an <img>
 * source flashes black while the next picture decodes). Only the arrows at the sides (and the arrow keys) turn the table, slowly and evenly, one
 * trophy at a time: no dragging or swiping (the owner found the arrows cleaner, and a finger on the table never fights scrolling). A phone gets a
 * smaller set (the same 120 pictures at 660 wide) because 120 full-size decoded pictures are more than an iPhone lets a page hold: it kills the tab. Every turn shows the nearest single picture, never two laid over each other
 * (a cross-fade of neighbours makes a ghost of every trophy). Two canvases are stacked: a sharp one shown only when the table is at rest (it fades in),
 * and a plain one drawn while it turns, so a turn never reallocates a canvas.
 * When a trophy settles, its champions hang from the rafters below as cloth banners that drop in, bounce into place and then ripple and sway freely.
 * Until the champions have arrived (`seasons` is null) the rafters stay bare: "No champion yet" is said only when it is true.
 */
type Champion = { name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };

/** The picture sets: every picture is named by its position in the 120 (the phone set is the same views, smaller). */
const PROFILES = {
  full: { frames: 120, step: 3, width: 1100, height: 825, restWidth: 2200, restHeight: 1650, dir: "", workers: 4 },
  small: { frames: 120, step: 3, width: 660, height: 495, restWidth: 1320, restHeight: 990, dir: "sm/", workers: 3 },
} as const;
type Profile = (typeof PROFILES)[keyof typeof PROFILES];

const REST = 120;               // degrees between one trophy at the front and the next
const TROPHIES = [
  { pool: "pickem", label: "Pick’em", tag: "Pick’em champion" },
  { pool: "bowl", label: "Bowl Pool", tag: "Bowl Pool champion" },
  { pool: "survivor", label: "Survivor", tag: "Survivor champion" },
] as const;

const wrap = (angle: number) => ((angle % 360) + 360) % 360;
const frameSrc = (profile: Profile, slot: number) => `/trophies/turntable/${profile.dir}frame-${String(slot * (360 / profile.frames) / 3).padStart(3, "0")}.webp`;
const sharpSrc = (profile: Profile, trophy: number) => `/trophies/turntable/${profile.dir}rest-${trophy}.webp`;
const frontOf = (angle: number) => Math.round(wrap(angle) / REST) % TROPHIES.length;
const nearestRest = (angle: number) => Math.round(angle / REST) * REST;
const phoneSized = () => typeof window !== "undefined" && window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;

export default function TrophyTurntable({ seasons }: { seasons: Season[] | null }) {
  const moveCanvas = useRef<HTMLCanvasElement>(null);
  const restCanvas = useRef<HTMLCanvasElement>(null);
  const [chosen, setChosen] = useState<Profile | null>(null);   // which picture set, decided once on the device (nothing is fetched before)
  const profile = chosen ?? PROFILES.full;
  const bitmaps = useRef<Array<ImageBitmap | null>>([]);
  const sharp = useRef<Array<ImageBitmap | null>>([null, null, null]);   // the resting views, sharp
  const angle = useRef(0);
  const frame = useRef<number | null>(null);
  const [front, setFront] = useState(0);        // the trophy at the front once the table has settled
  const [shown, setShown] = useState(0);        // the trophy whose banners are hanging: they stay until the table has settled on the next
  const [moving, setMoving] = useState(false);  // true while the table is being turned
  const [atRest, setAtRest] = useState(true);   // the sharp canvas is showing
  const loaded = useRef(0);
  const [ready, setReady] = useState(false);       // every picture has arrived

  // a phone gets the smaller set (decided once, before anything is fetched)
  useEffect(() => {
    const id = requestAnimationFrame(() => setChosen(phoneSized() ? PROFILES.small : PROFILES.full));
    return () => cancelAnimationFrame(id);
  }, []);

  const draw = useCallback(() => {
    const move = moveCanvas.current, rest = restCanvas.current, p = profile;
    if (!move || !rest) return;
    const turned = wrap(angle.current), resting = Math.round(turned / REST) % TROPHIES.length;
    const offRest = Math.min(Math.abs(turned - resting * REST), Math.abs(turned - resting * REST - 360));
    // exactly at rest, the sharp picture of that trophy (if it has arrived), on its own canvas
    const crisp = offRest < 0.05 ? sharp.current[resting] : null;
    if (crisp) {
      rest.getContext("2d")?.drawImage(crisp, 0, 0, p.restWidth, p.restHeight);
      setAtRest(true);
      return;
    }
    setAtRest(false);
    const context = move.getContext("2d");
    if (!context) return;
    // the nearest single picture (never two blended: that ghosts every trophy)
    const wanted = Math.round(turned / p.step) % p.frames;
    const pick = () => {   // the nearest picture that has arrived, if the wanted one is still on its way
      for (let reach = 0; reach < p.frames / 2; reach += 1) {
        const bitmap = bitmaps.current[(wanted + reach) % p.frames] ?? bitmaps.current[(wanted - reach + p.frames) % p.frames];
        if (bitmap) return bitmap;
      }
      return undefined;
    };
    const picture = pick();
    if (picture) context.drawImage(picture, 0, 0, p.width, p.height);
  }, [profile]);

  useEffect(() => {
    if (!chosen) return;
    let cancelled = false;
    const p = chosen;
    bitmaps.current = Array.from({ length: p.frames }, () => null);
    sharp.current = [null, null, null];
    loaded.current = 0;
    const queue = loadOrder(p.frames, REST / p.step);
    const worker = async () => {
      while (!cancelled) {
        const slot = queue.shift();
        if (slot === undefined) return;
        try {
          const bitmap = await createImageBitmap(await (await fetch(frameSrc(p, slot))).blob());
          if (cancelled) { bitmap.close(); return; }
          bitmaps.current[slot] = bitmap;
          loaded.current += 1;
          if (loaded.current === p.frames) setReady(true);
          if (Math.round(wrap(angle.current) / p.step) % p.frames === slot) draw();
        } catch { /* a missing picture leaves its neighbour on screen */ }
      }
    };
    void Promise.all(Array.from({ length: p.workers }, worker));
    // the sharp resting views, one at a time
    void (async () => {
      for (let trophy = 0; trophy < TROPHIES.length && !cancelled; trophy += 1) {
        try {
          const bitmap = await createImageBitmap(await (await fetch(sharpSrc(p, trophy))).blob());
          if (cancelled) { bitmap.close(); return; }
          sharp.current[trophy] = bitmap;
          draw();
        } catch { /* the ordinary picture stays */ }
      }
    })();
    return () => {
      cancelled = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      for (const bitmap of [...bitmaps.current, ...sharp.current]) bitmap?.close();   // hand the memory back at once
    };
  }, [chosen, draw]);

  const set = useCallback((next: number) => { angle.current = next; draw(); }, [draw]);

  /** Turn smoothly to an angle by the short way round, then report which trophy is at the front: slowly and evenly, easing in and out like a heavy
   *  table, never faster than about 10 degrees a frame (the fluted pedestal repeats every 22.5 degrees, so a faster turn makes its flutes appear to
   *  roll backwards). */
  const turnTo = useCallback((target: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const from = angle.current, delta = ((target - from + 540) % 360) - 180;
    const finish = () => { frame.current = null; setFront(frontOf(angle.current)); setMoving(false); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || delta === 0) { set(from + delta); finish(); return; }
    setMoving(true);
    const start = performance.now(), duration = Math.min(1500, 400 + Math.abs(delta) * 9);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration), eased = 0.5 - Math.cos(Math.PI * t) / 2;
      set(from + delta * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick); else finish();
    };
    frame.current = requestAnimationFrame(tick);
  }, [set]);

  // The banners stay while the table turns. Once it has settled on a different trophy the old ones lift away and the new ones are lowered.
  const lifting = front !== shown;   // the old banners lift away just before the new ones are lowered
  useEffect(() => {
    if (front === shown) return;
    const timer = window.setTimeout(() => setShown(front), 280);
    return () => window.clearTimeout(timer);
  }, [front, shown]);

  const turnBy = useCallback((steps: number) => turnTo(nearestRest(angle.current) + steps * REST), [turnTo]);

  const roll = seasons ? championRoll(seasons, TROPHIES[shown].pool) : null;

  return (
    <div className="trophy-display">
      <div
        aria-label="The trophies on their table. Use the arrows to turn it."
        className="trophy-turn-stage"
        data-ready={ready ? "true" : "false"}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); turnBy(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); turnBy(1); }
        }}
        role="group"
        tabIndex={0}
      >
        <Image alt="" className="trophy-turn-poster" draggable={false} height={PROFILES.full.height} priority src="/trophies/turntable/frame-000.webp" unoptimized width={PROFILES.full.width} />
        <canvas aria-hidden="true" className="trophy-turn-canvas" data-layer="move" height={profile.height} ref={moveCanvas} width={profile.width} />
        <canvas aria-hidden="true" className="trophy-turn-canvas" data-layer="rest" data-visible={atRest ? "true" : "false"} height={profile.restHeight} ref={restCanvas} width={profile.restWidth} />
        <button aria-label="Bring the previous trophy forward" className="trophy-turn-arrow" data-side="left" onClick={() => { haptic("tick"); turnBy(-1); }} type="button">‹<HapticTap /></button>
        <button aria-label="Bring the next trophy forward" className="trophy-turn-arrow" data-side="right" onClick={() => { haptic("tick"); turnBy(1); }} type="button">›<HapticTap /></button>
        <p aria-live="polite" className="sr-only" role="status">{moving ? "Turning" : `${TROPHIES[front].label} is at the front`}</p>
      </div>
      <section aria-label={`${TROPHIES[shown].label} champions`} className="trophy-rafters" data-moving={lifting ? "true" : "false"} data-pool={TROPHIES[shown].pool} key={shown}>
        <div aria-hidden="true" className="trophy-beam" />
        {roll === null ? null : roll.length ? (
          <ul className="trophy-banners">
            {roll.map((banner, index) => (
              <li className="trophy-banner" key={banner.playerId} style={{ "--i": index } as React.CSSProperties}>
                <TrophyBanner index={index} name={banner.name} still={moving} tag={TROPHIES[shown].tag} years={banner.years} />
                <span className="sr-only">{banner.name}, {TROPHIES[shown].tag}, {banner.years.join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : <p className="trophy-banners-empty">No {TROPHIES[shown].label} champion yet.</p>}
      </section>
    </div>
  );
}
