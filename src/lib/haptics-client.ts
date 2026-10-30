import { androidPattern, hapticKind, iphoneTickPlan, type Feel } from "@/lib/haptics.js";

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const hasVibrate = () => typeof navigator.vibrate === "function";

/** What this device can do: a vibration motor (Android), the iPhone switch tick, or nothing (a computer). */
export function hapticsAvailable() {
  return hapticKind({ hasVibrate: hasVibrate(), isIPhone: isIPhone() });
}

let tickSwitch: HTMLLabelElement | null = null;

/**
 * One iPhone tick: flips a hidden system switch (iOS 18 and later gives its light tick when a switch is flipped by a tap). It only works at the moment
 * of a tap, so it is called straight from tap handlers. Created the first time it is needed, and never visible or reachable.
 */
function iphoneTick() {
  if (!tickSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.setAttribute("data-haptic-switch", "");
    label.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    tickSwitch = label;
  }
  tickSwitch.click();
}

/**
 * Gives one feel, the same way everywhere. Returns what it did, so the Feel test can say so; everywhere else the answer is ignored. Never throws:
 * a device without haptics, or one that refuses, simply gets nothing.
 */
export function haptic(feel: Feel, { tryAll = false }: { tryAll?: boolean } = {}): string {
  try {
    const kind = hapticsAvailable();
    if (kind === "android") {
      const pattern = androidPattern(feel);
      navigator.vibrate(pattern);
      return `vibration ${pattern.join("-")} ms`;
    }
    if (kind === "iphone") {
      const { ticks, gapMs } = iphoneTickPlan(feel, tryAll);
      if (ticks === 0) return "nothing (an iPhone only gets a feel at the tap itself)";
      iphoneTick();
      for (let tick = 1; tick < ticks; tick += 1) window.setTimeout(iphoneTick, gapMs * tick);
      return ticks === 1 ? "one iPhone tick" : `${ticks} iPhone ticks, ${gapMs} ms apart`;
    }
    return "nothing (this device has no haptics)";
  } catch {
    return "nothing (the device refused)";
  }
}

/** One iPhone tick later than the tap, or on its own, for the Feel test's experiments. */
export function iphoneExperiment(delayMs: number, count = 1, gapMs = 0) {
  if (hapticsAvailable() !== "iphone") return "nothing (not an iPhone)";
  const fire = () => { for (let tick = 0; tick < count; tick += 1) window.setTimeout(iphoneTick, gapMs * tick); };
  if (delayMs > 0) window.setTimeout(fire, delayMs); else fire();
  return `${count} tick${count === 1 ? "" : "s"}${delayMs > 0 ? ` after ${delayMs} ms` : ""}`;
}
