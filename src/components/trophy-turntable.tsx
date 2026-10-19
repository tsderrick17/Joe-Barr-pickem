"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import TrophyBanner from "@/components/trophy-banner";
import { championRoll } from "@/lib/trophy-roll.js";
import { loadOrder } from "@/lib/trophy-turn.js";

/**
 * The three trophies on a mahogany table that turns. The table is a set of 120 pictures, one for every 3 degrees of a full turn
 * (rendered once, see tools/trophy-render). They are all fetched and decoded in the background and drawn onto one canvas, so a
 * spin never waits on an image (swapping an <img> source flashes black while the next picture decodes). Dragging or swiping turns
 * the table, a flick carries on and settles the nearest trophy at the front, and the arrows at the sides bring the next one forward.
 * When a trophy settles, its champions hang from the rafters below as cloth banners that drop in, bounce into place and then ripple and sway freely.
 */
type Champion = { name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };

const FRAMES = 120;
const STEP = 360 / FRAMES;      // degrees between pictures
const REST = 120;               // degrees between one trophy at the front and the next
const WIDTH = 1100, HEIGHT = 825;
const SHARP = 2;               // the three resting views are also kept at twice the size, so the names on the plaques are sharp when the table is at rest
const TROPHIES = [
  { pool: "pickem", label: "Pick’em", tag: "Pick’em champion" },
  { pool: "bowl", label: "Bowl Pool", tag: "Bowl Pool champion" },
  { pool: "survivor", label: "Survivor", tag: "Survivor champion" },
] as const;

const wrap = (angle: number) => ((angle % 360) + 360) % 360;
const frameSrc = (index: number) => `/trophies/turntable/frame-${String(index).padStart(3, "0")}.webp`;
const sharpSrc = (trophy: number) => `/trophies/turntable/rest-${trophy}.webp`;
const frontOf = (angle: number) => Math.round(wrap(angle) / REST) % TROPHIES.length;
const nearestRest = (angle: number) => Math.round(angle / REST) * REST;

export default function TrophyTurntable({ seasons }: { seasons: Season[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmaps = useRef<Array<ImageBitmap | null>>(Array.from({ length: FRAMES }, () => null));
  const sharp = useRef<Array<ImageBitmap | null>>([null, null, null]);   // the resting views at twice the size
  const angle = useRef(0);
  const frame = useRef<number | null>(null);
  const drag = useRef<{ startX: number; startAngle: number; samples: Array<{ t: number; x: number }> } | null>(null);
  const [front, setFront] = useState(0);        // the trophy at the front once the table has settled
  const [moving, setMoving] = useState(false);  // true while the table is being turned (the banners lift away)
  const loaded = useRef(0);
  const [ready, setReady] = useState(false);       // every picture has arrived

  const draw = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    // exactly at rest, the sharp picture of that trophy (if it has arrived)
    const turned = wrap(angle.current), atRest = Math.round(turned / REST) % TROPHIES.length;
    const offRest = Math.min(Math.abs(turned - atRest * REST), Math.abs(turned - atRest * REST - 360));
    const crisp = offRest < 0.05 ? sharp.current[atRest] : null;
    if (crisp) { context.drawImage(crisp, 0, 0, WIDTH * SHARP, HEIGHT * SHARP); return; }
    const wanted = Math.round(turned / STEP) % FRAMES;
    for (let reach = 0; reach < FRAMES / 2; reach += 1) {     // the nearest picture that has arrived, if the wanted one is still on its way
      const bitmap = bitmaps.current[(wanted + reach) % FRAMES] ?? bitmaps.current[(wanted - reach + FRAMES) % FRAMES];
      if (bitmap) { context.drawImage(bitmap, 0, 0, WIDTH * SHARP, HEIGHT * SHARP); return; }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const queue = loadOrder(FRAMES, REST / STEP);
    const worker = async () => {
      while (!cancelled) {
        const index = queue.shift();
        if (index === undefined) return;
        try {
          const blob = await (await fetch(frameSrc(index))).blob();
          const bitmap = await createImageBitmap(blob);
          if (cancelled) return;
          bitmaps.current[index] = bitmap;
          loaded.current += 1;
          if (loaded.current === FRAMES) setReady(true);
          if (Math.round(wrap(angle.current) / STEP) % FRAMES === index) draw();
        } catch { /* a missing picture leaves its neighbour on screen */ }
      }
    };
    void Promise.all(Array.from({ length: 6 }, worker));
    // then the sharp resting views, one at a time, once the spin's own pictures are on their way
    void (async () => {
      for (let trophy = 0; trophy < TROPHIES.length && !cancelled; trophy += 1) {
        try {
          const bitmap = await createImageBitmap(await (await fetch(sharpSrc(trophy))).blob());
          if (cancelled) return;
          sharp.current[trophy] = bitmap;
          draw();
        } catch { /* the ordinary picture stays */ }
      }
    })();
    return () => { cancelled = true; if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [draw]);

  const set = useCallback((next: number) => { angle.current = next; draw(); }, [draw]);

  /** Turn smoothly to an angle by the short way round, then report which trophy is at the front. The arrow buttons turn it slowly and evenly, easing
   *  in and out like a heavy table; a settle after a drag or flick keeps the quicker, ease-out turn. Neither may go faster than about 10 degrees a
   *  frame: the pictures are 3 degrees apart and the fluted pedestal repeats every 22.5, so a faster turn makes its flutes appear to roll backwards. */
  const turnTo = useCallback((target: number, slow = false) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const from = angle.current, delta = ((target - from + 540) % 360) - 180;
    const finish = () => { frame.current = null; setFront(frontOf(angle.current)); setMoving(false); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || delta === 0) { set(from + delta); finish(); return; }
    setMoving(true);
    const start = performance.now(), duration = slow ? Math.min(1500, 400 + Math.abs(delta) * 9) : Math.min(900, 220 + Math.abs(delta) * 4);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration), eased = slow ? 0.5 - Math.cos(Math.PI * t) / 2 : 1 - Math.pow(1 - t, 3);
      set(from + delta * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick); else finish();
    };
    frame.current = requestAnimationFrame(tick);
  }, [set]);

  /** A touch that ends without a release (the browser took it to scroll the page, say) must not leave the table between two trophies. */
  const settle = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    turnTo(nearestRest(angle.current));
  }, [turnTo]);

  const turnBy = useCallback((steps: number) => turnTo(nearestRest(angle.current) + steps * REST, true), [turnTo]);

  const roll = championRoll(seasons, TROPHIES[front].pool);

  return (
    <div className="trophy-display">
      <div
        aria-label="The trophies on their table. Drag, or use the arrow keys, to turn it."
        className="trophy-turn-stage"
        data-ready={ready ? "true" : "false"}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); turnBy(-1); }
          if (event.key === "ArrowRight") { event.preventDefault(); turnBy(1); }
        }}
        onPointerCancel={() => settle()}
        onLostPointerCapture={() => settle()}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
          drag.current = { startX: event.clientX, startAngle: angle.current, samples: [{ t: performance.now(), x: event.clientX }] };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const width = event.currentTarget.getBoundingClientRect().width || 1;
          if (!moving && Math.abs(event.clientX - current.startX) > 4) setMoving(true);
          set(current.startAngle - ((event.clientX - current.startX) / width) * 200);   // a swipe across the picture is about 200 degrees
          current.samples.push({ t: performance.now(), x: event.clientX });
          if (current.samples.length > 6) current.samples.shift();
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          if (!current) return;
          drag.current = null;
          const width = event.currentTarget.getBoundingClientRect().width || 1, now = performance.now(), recent = current.samples.filter((sample) => now - sample.t < 90);   // only the last instant counts: a pause before letting go is no flick
          const first = recent[0], last = recent[recent.length - 1];
          const velocity = first && last && last.t > first.t ? ((-(last.x - first.x) / width) * 200) / (last.t - first.t) : 0;   // degrees per millisecond
          turnTo(nearestRest(angle.current + velocity * 180));                                                   // a flick carries on a little
        }}
        role="group"
        tabIndex={0}
      >
        <Image alt="" className="trophy-turn-poster" draggable={false} height={HEIGHT} priority src={frameSrc(0)} unoptimized width={WIDTH} />
        <canvas aria-hidden="true" className="trophy-turn-canvas" height={HEIGHT * SHARP} ref={canvasRef} width={WIDTH * SHARP} />
        <button aria-label="Bring the previous trophy forward" className="trophy-turn-arrow" data-side="left" onClick={() => turnBy(-1)} type="button">‹</button>
        <button aria-label="Bring the next trophy forward" className="trophy-turn-arrow" data-side="right" onClick={() => turnBy(1)} type="button">›</button>
        <p aria-live="polite" className="sr-only" role="status">{moving ? "Turning" : `${TROPHIES[front].label} is at the front`}</p>
      </div>
      <section aria-label={`${TROPHIES[front].label} champions`} className="trophy-rafters" data-moving={moving ? "true" : "false"} data-pool={TROPHIES[front].pool} key={front}>
        <div aria-hidden="true" className="trophy-beam" />
        {roll.length ? (
          <ul className="trophy-banners">
            {roll.map((banner, index) => (
              <li className="trophy-banner" key={banner.playerId} style={{ "--i": index } as React.CSSProperties}>
                <TrophyBanner index={index} name={banner.name} tag={TROPHIES[front].tag} years={banner.years} />
                <span className="sr-only">{banner.name}, {TROPHIES[front].tag}, {banner.years.join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : <p className="trophy-banners-empty">No {TROPHIES[front].label} champion yet.</p>}
      </section>
    </div>
  );
}
