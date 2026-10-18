"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { championRoll } from "@/lib/trophy-roll.js";

/**
 * The three trophies, each a picture with no plaques on it, with a real brass plaque laid over the picture for every champion on
 * record (newest in the first slot, then the next, and so on). Plaques are made of live data: a new champion appears here the day
 * they are crowned, with no new picture. Where a trophy has no more room in view, the older champions are listed under the
 * picture. Tapping a plaque shows it large.
 */
type Champion = { name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };
type Slot = { cx: number; cy: number; w: number; h: number };
type Pool = "pickem" | "survivor" | "bowl";

// Slot positions are where the plaque places sit in each picture, as fractions of it (measured from the render itself).
const TROPHIES: Array<{ pool: Pool; label: string; src: string; note: string; slots: Slot[] }> = [
  { pool: "pickem", label: "Pick’em", src: "/trophies/pickem.jpg", note: "The marble pillar and its twin metal helix.", slots: [
    { cx: 0.5, cy: 0.7505, w: 0.1542, h: 0.0431 }, { cx: 0.5, cy: 0.8067, w: 0.1638, h: 0.036 },
  ] },
  { pool: "bowl", label: "Bowl Pool", src: "/trophies/bowl.jpg", note: "The pennant cup.", slots: [
    { cx: 0.5, cy: 0.7874, w: 0.1412, h: 0.0385 },
  ] },
  { pool: "survivor", label: "Survivor", src: "/trophies/survivor.jpg", note: "The crystal spade and its chip.", slots: [
    { cx: 0.3251, cy: 0.752, w: 0.1551, h: 0.0407 }, { cx: 0.5, cy: 0.752, w: 0.1548, h: 0.0407 }, { cx: 0.6749, cy: 0.752, w: 0.1545, h: 0.0407 },
    { cx: 0.3973, cy: 0.6957, w: 0.1371, h: 0.0406 }, { cx: 0.6027, cy: 0.6957, w: 0.1367, h: 0.0406 },
  ] },
];
const IMAGE = { width: 704, height: 1120 };

export type RollEntry = { year: number; names: string };

/** A brass cartouche: notched corners, a rounded boss at each end, rivets, a double keyline, and the year and name engraved in dark brass. */
function PlaqueFace({ entry, ratio, bosses = true }: { entry: RollEntry; ratio: number; bosses?: boolean }) {
  const id = useId().replace(/:/g, "");
  const W = 200, H = W / ratio, c = Math.min(H * 0.26, W * 0.1), b = H * 0.2, mid = H / 2;
  const outline = `M ${c} 0 L ${W - c} 0 A ${c} ${c} 0 0 0 ${W} ${c} L ${W} ${mid - b} A ${b} ${b} 0 0 1 ${W} ${mid + b} L ${W} ${H - c} A ${c} ${c} 0 0 0 ${W - c} ${H} L ${c} ${H} A ${c} ${c} 0 0 0 0 ${H - c} L 0 ${mid + b} A ${b} ${b} 0 0 1 0 ${mid - b} L 0 ${c} A ${c} ${c} 0 0 0 ${c} 0 Z`;
  const name = entry.names.toUpperCase();
  const nameSize = Math.min(H * 0.3, (W * 0.74) / Math.max(5, name.length * 0.74));
  const inset = H * 0.15;
  return (
    <svg aria-hidden="true" preserveAspectRatio="xMidYMid meet" viewBox={`${-b} -2 ${W + 2 * b} ${H + 4}`}>
      <defs>
        <linearGradient id={`brass-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f3dc93" /><stop offset="0.45" stopColor="#d4a43b" /><stop offset="1" stopColor="#8d6a22" />
        </linearGradient>
      </defs>
      <path d={outline} fill={`url(#brass-${id})`} stroke="#6b4e17" strokeWidth={H * 0.025} />
      <rect fill="none" height={H - 2 * inset} rx={H * 0.08} stroke="#3a2a0e" strokeWidth={H * 0.03} width={W - 2 * inset} x={inset} y={inset} />
      <rect fill="none" height={H - 2 * inset - H * 0.1} rx={H * 0.05} stroke="#3a2a0e" strokeWidth={H * 0.012} width={W - 2 * inset - H * 0.1} x={inset + H * 0.05} y={inset + H * 0.05} />
      {bosses ? [0, W].map((x) => <circle cx={x} cy={mid} fill="#e6c365" key={x} r={b * 0.5} stroke="#6b4e17" strokeWidth={H * 0.012} />) : null}
      {[[c * 0.35, c * 0.35], [W - c * 0.35, c * 0.35], [c * 0.35, H - c * 0.35], [W - c * 0.35, H - c * 0.35]].map(([x, y]) => <circle cx={x} cy={y} fill="#e6c365" key={`${x}-${y}`} r={H * 0.035} stroke="#6b4e17" strokeWidth={H * 0.01} />)}
      <g fill="#2a1b08" fontFamily="var(--font-cormorant), Georgia, serif" fontWeight={700} textAnchor="middle">
        <text fontSize={H * 0.2} letterSpacing={H * 0.05} x={W / 2} y={H * 0.38}>{entry.year}</text>
        <text fontSize={nameSize} letterSpacing={nameSize * 0.06} x={W / 2} y={H * 0.72}>{name}</text>
      </g>
    </svg>
  );
}

export default function TrophyDisplay({ seasons }: { seasons: Season[] }) {
  const [zoomed, setZoomed] = useState<{ entry: RollEntry; ratio: number } | null>(null);
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setZoomed(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);
  return (
    <>
      <div className="trophy-case mt-4">
        {TROPHIES.map((trophy) => {
          const roll = championRoll(seasons, trophy.pool);
          const shown = roll.slice(0, trophy.slots.length);
          return (
            <figure key={trophy.pool}>
              <div className="trophy-picture" style={{ aspectRatio: `${IMAGE.width} / ${IMAGE.height}` }}>
                <Image alt={`${trophy.label} trophy on its mantle`} height={IMAGE.height} priority src={trophy.src} width={IMAGE.width} />
                {shown.map((entry, index) => {
                  const slot = trophy.slots[index];
                  const ratio = (slot.w * IMAGE.width) / (slot.h * IMAGE.height);
                  return (
                    <button aria-label={`${trophy.label} champion ${entry.year}: ${entry.names}`} className="trophy-plaque" key={entry.year} onClick={() => setZoomed({ entry, ratio })} style={{ height: `${slot.h * 100 * 1.12}%`, left: `${slot.cx * 100}%`, top: `${slot.cy * 100}%`, width: `${slot.w * 100 * 1.1}%` }} type="button">
                      <PlaqueFace entry={entry} ratio={ratio} />
                    </button>
                  );
                })}
              </div>
              <figcaption>
                <b>{trophy.label}</b>
                <span>{trophy.note}</span>
                {roll.length ? <ul className="trophy-roll">{roll.map((entry) => <li key={entry.year}><span>{entry.year}</span> {entry.names}</li>)}</ul> : <span>No champion yet.</span>}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {zoomed ? (
        <div aria-label="Plaque" aria-modal="true" className="trophy-zoom" onClick={() => setZoomed(null)} role="dialog">
          <div style={{ aspectRatio: `${zoomed.ratio}` }}><PlaqueFace entry={zoomed.entry} ratio={zoomed.ratio} /></div>
        </div>
      ) : null}
    </>
  );
}
