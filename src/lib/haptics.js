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
 * An iPhone cannot vibrate. Since iOS 18 a switch on a page gives the system's light tick when it is flipped by a tap, and nothing later:
 * so the iPhone only gets a feel at the moment of the tap itself (a lock-in is two quick ticks, to feel heavier). Success, warning and ratchet come
 * after a wait or in mid-drag, so they stay silent there, unless `tryAll` asks for one tick anyway (the Feel test does, to find out what an iPhone allows).
 * @param {Feel} feel
 * @param {boolean} [tryAll]
 * @returns {{ ticks: number, gapMs: number }}
 */
export function iphoneTickPlan(feel, tryAll = false) {
  if (feel === "tick" || feel === "lightTick") return { ticks: 1, gapMs: 0 };
  if (feel === "lockIn") return { ticks: 2, gapMs: 35 };
  return { ticks: tryAll ? 1 : 0, gapMs: 0 };
}

/**
 * Which kind of haptics this device has, from what the page can read about it.
 * @param {{ hasVibrate: boolean, isIPhone: boolean }} facts
 * @returns {"android" | "iphone" | "none"}
 */
export function hapticKind({ hasVibrate, isIPhone }) {
  if (hasVibrate) return "android";
  return isIPhone ? "iphone" : "none";
}
