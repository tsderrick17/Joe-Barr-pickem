import { androidPattern, hapticKind, iphoneTicksOnTap, VIBRATION_KEY, vibrationWanted, type Feel } from "@/lib/haptics.js";

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const hasVibrate = () => typeof navigator.vibrate === "function";

/** What this device can do: a vibration motor (Android), the iPhone switch tick, or nothing (a computer). */
export function hapticsAvailable() {
  return hapticKind({ hasVibrate: hasVibrate(), isIPhone: isIPhone() });
}

const vibrationListeners = new Set<() => void>();

/** Whether this device's Vibration switch is on (it is, until a player turns it off). Kept on the device, like the theme. */
export function vibrationOn() {
  try { return vibrationWanted(window.localStorage.getItem(VIBRATION_KEY)); } catch { return true; }
}

export function setVibration(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(VIBRATION_KEY);
    else window.localStorage.setItem(VIBRATION_KEY, "off");
  } catch { /* private browsing: it just stays as it was */ }
  for (const listener of vibrationListeners) listener();
}

/** For `useSyncExternalStore`: tells the listener when the Vibration switch changes, here or in another tab. */
export function subscribeVibration(listener: () => void) {
  vibrationListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { vibrationListeners.delete(listener); window.removeEventListener("storage", listener); };
}

/**
 * Gives one feel, the same way everywhere. Returns what it did, so the Feel test can say so; everywhere else the answer is ignored. Never throws:
 * a device without haptics, or one that refuses, simply gets nothing. On an iPhone the tick itself comes from the button's `HapticTap` (the finger
 * flips its hidden switch), so this only says whether there was one. A device whose Vibration switch is off gets nothing (the Feel test passes
 * `always` so the Commissioner can still feel each one).
 */
export function haptic(feel: Feel, options: { always?: boolean } = {}): string {
  try {
    if (!options.always && !vibrationOn()) return "nothing (vibration is off)";
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
