"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { GROUPS, SPOKES, SPOKE_COUNT } from "@/lib/commissioner-wheel.js";
import { haptic } from "@/lib/haptics-client";
import { HapticTap } from "@/components/haptic-tap";
import { useCommissionerStatus } from "@/components/commissioner/commissioner-status";
import { Medallion, Sheet, STATE_WORDS, type SpokeState } from "@/components/commissioner/wheel-parts";

const STEP = 360 / SPOKE_COUNT;
const SPOKE_RADIUS = 136;
const angle = (index: number) => -90 + index * STEP;
// Rounded, so the server and the browser draw exactly the same numbers.
const round = (value: number) => Math.round(value * 100) / 100;
const point = (degrees: number, radius: number) => [round(200 + radius * Math.cos(degrees * Math.PI / 180)), round(200 + radius * Math.sin(degrees * Math.PI / 180))];

function arc(from: number, to: number, radius: number, reverse: boolean) {
  const [x0, y0] = point(reverse ? to : from, radius), [x1, y1] = point(reverse ? from : to, radius);
  return `M${x0} ${y0} A${radius} ${radius} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${reverse ? 0 : 1} ${x1} ${y1}`;
}

function band(from: number, to: number, inner: number, outer: number) {
  const [x0, y0] = point(from, outer), [x1, y1] = point(to, outer), [x2, y2] = point(to, inner), [x3, y3] = point(from, inner);
  const large = to - from > 180 ? 1 : 0;
  return `M${x0} ${y0} A${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${inner} ${inner} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** The brass bezel, its ticks, and the four coloured group bands with their names curved along the rim. Drawn once; it never turns. */
function WheelFace() {
  const ticks = Array.from({ length: 72 }, (_, index) => index * 5);
  return <svg aria-hidden="true" className="cw-face" viewBox="0 0 400 400">
    <defs>
      <radialGradient cx="50%" cy="45%" id="cw-face" r="60%"><stop offset="0" stopColor="#245c47" /><stop offset=".65" stopColor="#163a2e" /><stop offset="1" stopColor="#0b1f18" /></radialGradient>
      <linearGradient id="cw-bezel" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#f0dca8" /><stop offset=".5" stopColor="#b8904d" /><stop offset="1" stopColor="#f0dca8" /></linearGradient>
      <radialGradient cx="35%" cy="25%" id="cw-sheen" r="60%"><stop offset="0" stopColor="#fff" stopOpacity=".12" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></radialGradient>
    </defs>
    <circle cx="200" cy="200" fill="url(#cw-bezel)" r="198" />
    <circle cx="200" cy="200" fill="url(#cw-face)" r="181" stroke="#0d241c" strokeWidth="2" />
    {ticks.map((degrees) => {
      const [x0, y0] = point(degrees, 180), [x1, y1] = point(degrees, degrees % 10 ? 176 : 172);
      return <line key={degrees} stroke="rgba(230,207,152,.4)" strokeWidth={degrees % 10 ? 1 : 1.6} x1={x0} x2={x1} y1={y0} y2={y1} />;
    })}
    {GROUPS.map((group, groupIndex) => {
      const members = SPOKES.map((spoke, index) => spoke.group === groupIndex ? index : -1).filter((index) => index >= 0);
      const from = angle(members[0]) - STEP / 2 + 1.5, to = angle(members[members.length - 1]) + STEP / 2 - 1.5;
      const middle = (from + to) / 2, lower = Math.sin(middle * Math.PI / 180) > 0.2;
      return <g key={group.label}>
        <path d={band(from, to, 96, 170)} fill={group.color} opacity=".6" />
        <path d={arc(from, to, lower ? 193 : 187, lower)} fill="none" id={`cw-group-${groupIndex}`} />
        <text fill="#163a2e" fontSize="10" fontWeight="800" letterSpacing="3"><textPath href={`#cw-group-${groupIndex}`} startOffset="50%" textAnchor="middle">{group.label}</textPath></text>
      </g>;
    })}
    <circle cx="200" cy="200" fill="url(#cw-sheen)" r="181" />
    <circle cx="200" cy="200" fill="none" r="74" stroke="rgba(201,164,95,.35)" strokeDasharray="2 5" />
  </svg>;
}

/**
 * The Commissioner's home: ten spokes round a wheel, each a page, in four groups. Each ring shows that page's state; the red felt hub in the
 * middle counts what needs the Commissioner and opens the list. The wheel never turns: a tapped spoke presses in, springs back with a ripple,
 * the others dim, and its page opens a moment later.
 */
export default function CommissionerWheel() {
  const router = useRouter();
  const { map, failed, spokes, needs } = useCommissionerStatus();
  const [chosen, setChosen] = useState<string | null>(null);
  const [needsOpen, setNeedsOpen] = useState(false);

  useEffect(() => { SPOKES.forEach((spoke) => router.prefetch(spoke.href)); }, [router]);

  function choose(key: string, href: string) {
    if (chosen) return;
    haptic("tick");
    setChosen(key);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(href), reduced ? 0 : 340);
  }

  const hubCount = needs.length;
  return <section className="cw-home" aria-labelledby="cw-home-title">
    <div className="cw-greet">
      <h1 id="cw-home-title">{map?.headline ?? "Operations"}</h1>
      <p>{failed ? "The live status could not be read. Every page still works." : map?.summary ?? "Checking the pool…"}</p>
    </div>
    <div className={`cw-wheel ${chosen ? "is-choosing" : ""}`}>
      <WheelFace />
      {SPOKES.map((spoke, index) => {
        const [x, y] = point(angle(index), SPOKE_RADIUS);
        const status = spokes[spoke.key] as { state: SpokeState; count: number; line?: string };
        const lowest = Math.sin(angle(index) * Math.PI / 180) > 0.9;
        return <button
          aria-label={`${spoke.name}: ${status.line ?? spoke.line}. ${STATE_WORDS[status.state]}.`}
          className={`cw-spoke is-${status.state} ${chosen === spoke.key ? "is-chosen" : ""}`}
          key={spoke.key}
          onClick={() => choose(spoke.key, spoke.href)}
          style={{ left: `${x / 4}%`, top: `${y / 4}%`, animationDelay: `${index * 55}ms` } as CSSProperties}
          type="button"
        >
          <Medallion count={status.count} icon={spoke.icon} state={status.state} />
          {chosen === spoke.key ? <><span aria-hidden="true" className="cw-ripple" /><span aria-hidden="true" className="cw-ripple is-late" /></> : null}
          <span aria-hidden="true" className={`cw-name ${lowest ? "is-above" : ""}`}>{spoke.name}</span>
          <HapticTap />
        </button>;
      })}
      <button
        aria-label={hubCount ? `${hubCount} thing${hubCount === 1 ? "" : "s"} need${hubCount === 1 ? "s" : ""} you. Open the list.` : "Nothing needs you. Open the list."}
        className={`cw-hub ${hubCount ? "" : "is-clear"}`}
        onClick={() => { haptic("tick"); setNeedsOpen(true); }}
        type="button"
      >
        <span>
          <b>{map ? (hubCount || "✓") : "…"}</b>
          <span className="cw-hub-word">{hubCount || !map ? "Needs you" : "All clear"}</span>
          <small>see the list</small>
        </span>
        <HapticTap />
      </button>
    </div>
    <ul className="cw-legend" aria-label="What the ring colours mean">
      <li><i className="is-ok" />All good</li>
      <li><i className="is-warn" />Look soon</li>
      <li><i className="is-bad" />Needs you now</li>
      <li><i className="is-idle" />Nothing to report</li>
    </ul>
    <Sheet onClose={() => setNeedsOpen(false)} open={needsOpen} title="Needs you">
      {needs.length ? <ul className="cw-needs">
        {needs.map((item) => <li className={`is-${item.state}`} key={item.title}>
          <span aria-hidden="true" className="cw-dot" />
          <span className="cw-needs-words"><b>{item.title}</b><small>{item.detail}</small></span>
          <Link className="cw-go" href={item.href} onClick={() => setNeedsOpen(false)}>Go</Link>
        </li>)}
      </ul> : <p className="cw-clear">{map ? "Nothing needs you right now. The pool is running on its own." : "Still checking the pool…"}</p>}
    </Sheet>
  </section>;
}
