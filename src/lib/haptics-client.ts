import { androidPattern, hapticKind, iphoneTicksOnTap, type Feel } from "@/lib/haptics.js";

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const hasVibrate = () => typeof navigator.vibrate === "function";

/** What this device can do: a vibration motor (Android), the iPhone switch tick, or nothing (a computer). */
export function hapticsAvailable() {
  return hapticKind({ hasVibrate: hasVibrate(), isIPhone: isIPhone() });
}

/**
 * Gives one feel, the same way everywhere. Returns what it did, so the Feel test can say so; everywhere else the answer is ignored. Never throws:
 * a device without haptics, or one that refuses, simply gets nothing. On an iPhone the tick itself comes from the button's `HapticTap` (the finger
 * flips its hidden switch), so this only says whether there was one.
 */
export function haptic(feel: Feel): string {
  try {
    const kind = hapticsAvailable();
    if (kind === "android") {
      const pattern = androidPattern(feel);
      navigator.vibrate(pattern);
      return `vibration ${pattern.join("-")} ms`;
    }
    if (kind === "iphone") return iphoneTicksOnTap(feel) ? "one iPhone tick, from your tap" : "nothing (an iPhone only ticks at the tap itself)";
    return "nothing (this device has no haptics)";
  } catch {
    return "nothing (the device refused)";
  }
}
