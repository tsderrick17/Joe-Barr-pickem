"use client";

import { useRef, useState } from "react";
import { HapticTap } from "@/components/haptic-tap";
import { FEELS, iphoneTicksOnTap, type Feel } from "@/lib/haptics.js";
import { haptic, hapticsAvailable } from "@/lib/haptics-client";

const FEEL_LABELS: Record<Feel, { name: string; meaning: string }> = {
  tick: { name: "Tick", meaning: "a team or choice is picked" },
  lightTick: { name: "Light tick", meaning: "a pick is taken back" },
  lockIn: { name: "Lock-in", meaning: "a heavier choice (Survivor chip, letting go of the pull)" },
  success: { name: "Success", meaning: "your picks were saved" },
  warning: { name: "Warning", meaning: "that did not work" },
  ratchet: { name: "Ratchet", meaning: "one notch while pulling" },
};

const DEVICE_LINE = {
  android: "This phone can vibrate: you should feel every one of these.",
  iphone: "This is an iPhone: it gives one light tick at the moment your finger taps Tick, Light tick or Lock-in. The others are shown as the app will do them (nothing). The switch at the bottom is a plain iPhone switch, to compare.",
  none: "This device has no haptics (a computer, most likely). Try this on a phone.",
} as const;

const buttonClass = "min-h-12 px-4 py-3 font-bold transition";
const secondary = `${buttonClass} border border-zinc-500 bg-(color:--themed-bg-26) text-(color:--themed-text-18) hover:border-[#16877f] active:bg-[#dff0eb]`;

const NOTCH_DISTANCE = 36;   // pixels of pulling per notch
const NOTCHES = 4;

/** Commissioner-only: one button for every feel, a pretend pull-chain, and on an iPhone a plain switch to compare, so each can be felt on a real phone before players get any. */
export function HapticFeelTest() {
  const [last, setLast] = useState("");
  const [down, setDown] = useState(NOTCHES);
  const pull = useRef<{ startY: number; notches: number } | null>(null);
  const kind = typeof navigator === "undefined" ? "none" : hapticsAvailable();

  const give = (feel: Feel) => setLast(`${FEEL_LABELS[feel].name}: ${haptic(feel, { always: true })}`);

  function pullStart(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pull.current = { startY: event.clientY, notches: 0 };
    setDown(NOTCHES);
  }
  function pullMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = pull.current;
    if (!state) return;
    const notches = Math.min(NOTCHES, Math.max(0, Math.floor((event.clientY - state.startY) / NOTCH_DISTANCE)));
    if (notches > state.notches) {
      state.notches = notches;
      setDown(NOTCHES - notches);
      setLast(`Ratchet (notch ${notches}): ${haptic("ratchet", { always: true })}`);
    }
  }
  function pullEnd() {
    const state = pull.current;
    pull.current = null;
    if (state && state.notches === NOTCHES) setLast(`Lock-in (let go at the bottom): ${kind === "iphone" ? "nothing (an iPhone only ticks at the tap itself)" : haptic("lockIn", { always: true })}`);
    setDown(NOTCHES);
  }

  return <section aria-labelledby="haptic-feel-test-title" className="mt-8 border-y-2 border-(color:--themed-border-10) py-6" data-haptic-test={kind}>
    <h2 className="text-sm font-black tracking-[.14em]" id="haptic-feel-test-title">FEEL TEST (COMMISSIONER ONLY)</h2>
    <p className="mt-3 text-sm leading-5 text-slate-600">{DEVICE_LINE[kind]}</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {FEELS.map((feel) => <button className={`${secondary} relative text-left`} key={feel} onClick={() => give(feel)} type="button">
        <span className="block">{FEEL_LABELS[feel].name}</span>
        <span className="block text-sm font-normal text-slate-600">{FEEL_LABELS[feel].meaning}</span>
        {iphoneTicksOnTap(feel) ? <HapticTap always /> : null}
      </button>)}
    </div>
    <h3 className="mt-6 text-sm font-black tracking-[.1em]">PRETEND PULL</h3>
    <p className="mt-2 text-sm leading-5 text-slate-600">Put a finger on the box, drag down slowly and let go at the bottom. One notch for each count, a heavier tap when you let go.</p>
    <div aria-label="Pretend pull: drag down here" className="mt-3 flex min-h-40 touch-none select-none items-center justify-center border-2 border-dashed border-zinc-500 text-6xl font-black" data-pull-count={down} onPointerCancel={pullEnd} onPointerDown={pullStart} onPointerMove={pullMove} onPointerUp={pullEnd} role="img">{down}</div>
    {kind === "iphone" ? <>
      <h3 className="mt-6 text-sm font-black tracking-[.1em]">A PLAIN IPHONE SWITCH</h3>
      <p className="mt-2 text-sm leading-5 text-slate-600">Flip this switch with your finger. If it ticks but the buttons above do not, tell me.</p>
      <label className="mt-3 inline-flex min-h-12 items-center gap-3 font-bold">
        <input className="size-6" type="checkbox" {...{ switch: "" }} />
        Compare switch
      </label>
    </> : null}
    <p aria-live="polite" className="mt-4 min-h-6 font-semibold text-green-800" role="status">{last ? `Sent — ${last}` : ""}</p>
  </section>;
}
