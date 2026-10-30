// @ts-check

/**
 * The five feels the app uses, one meaning each, the same everywhere (see docs/PROJECT_REFERENCE.md, Haptics):
 * tick = chosen, lightTick = un-chosen, lockIn = a heavier choice, success = saved, warning = that did not work, ratchet = a notch while pulling.
 * @typedef {"tick" | "lightTick" | "lockIn" | "success" | "warning" | "ratchet"} Feel
 */

/** @type {Feel[]} */
export const FEELS = ["tick", "lightTick", "lockIn", "success", "warning", "ratchet"];

/** What a phone with a vibration motor does for each feel (milliseconds on, off, on, ...). Android only; the numbers are for tuning. */
const ANDROID = {
  tick: [10],
  lightTick: [6],
  lockIn: [26],
  success: [14, 60, 14],
  warning: [50, 70, 50],
  ratchet: [8],
};

/**
 * @param {Feel} feel
 * @returns {number[]}
 */
export function androidPattern(feel) {
  return ANDROID[feel] ?? ANDROID.tick;
}

/**
 * An iPhone cannot vibrate. A switch on a page gives the system's light tick when a finger flips it, and since iOS 26.5 only a real finger: a page
 * can no longer flip it from code (tested on the owner's iPhone, iOS 26.6). So the tick comes from a hidden switch laid over the button, exactly one
 * per tap. The choices (tick, light tick, lock-in) get it; success, warning and ratchet come after a wait or in mid-drag, so they stay silent there.
 * @param {Feel} feel
 * @returns {boolean}
 */
export function iphoneTicksOnTap(feel) {
  return feel === "tick" || feel === "lightTick" || feel === "lockIn";
}

/** The key this device's Vibration switch is kept under. Missing means on: only an explicit "off" turns haptics off. */
export const VIBRATION_KEY = "pickem-vibration";

/**
 * Whether haptics are wanted on this device, from what the Vibration switch stored.
 * @param {string | null | undefined} stored
 */
export function vibrationWanted(stored) {
  return stored !== "off";
}

/**
 * The notch to feel while pulling: the pull's down counter runs 4, 3, 2, 1 as it turns, so it passes three notches (to 3, to 2, to 1) and the last
 * one is the lock-in. 0 until the counter has turned a third of the way.
 * @param {number} counter how far the counter has turned, 0 to 1 (`pullStages(...).counter`)
 */
export function pullNotch(counter) {
  return Math.min(3, Math.floor(Math.max(0, counter) * 3 + 1e-9));
}

/**
 * Which kind of haptics this device has, from what the page can read about it.
 * Chrome on a computer also has `navigator.vibrate` (it does nothing without a motor), so a phone with a motor is told by being an Android device too.
 * @param {{ hasVibrate: boolean, isIPhone: boolean, isAndroid: boolean }} facts
 * @returns {"android" | "iphone" | "none"}
 */
export function hapticKind({ hasVibrate, isIPhone, isAndroid }) {
  if (hasVibrate && isAndroid) return "android";
  return isIPhone ? "iphone" : "none";
}
