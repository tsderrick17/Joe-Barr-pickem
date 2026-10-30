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

/**
 * Which kind of haptics this device has, from what the page can read about it.
 * @param {{ hasVibrate: boolean, isIPhone: boolean }} facts
 * @returns {"android" | "iphone" | "none"}
 */
export function hapticKind({ hasVibrate, isIPhone }) {
  if (hasVibrate) return "android";
  return isIPhone ? "iphone" : "none";
}
