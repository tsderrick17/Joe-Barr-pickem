import assert from "node:assert/strict";
import test from "node:test";
import { androidPattern, FEELS, hapticKind, iphoneTicksOnTap } from "../src/lib/haptics.js";

test("every feel has a vibration pattern; a saved double tap and a warning are felt differently from a tick", () => {
  for (const feel of FEELS) assert.ok(androidPattern(feel).length >= 1 && androidPattern(feel).every((ms) => ms > 0), feel);
  assert.equal(androidPattern("success").length, 3, "two taps with a gap");
  assert.ok(androidPattern("warning").reduce((a, b) => a + b) > androidPattern("success").reduce((a, b) => a + b), "a warning is longer than a success");
  assert.ok(androidPattern("lockIn")[0] > androidPattern("tick")[0], "a lock-in is firmer than a tick");
  assert.ok(androidPattern("lightTick")[0] < androidPattern("tick")[0], "taking a pick back is lighter than choosing");
});

test("an iPhone only gets a feel at the tap itself: a tick for every choice, nothing after a wait or mid-drag", () => {
  for (const feel of ["tick", "lightTick", "lockIn"]) assert.equal(iphoneTicksOnTap(feel), true, `${feel} ticks on an iPhone`);
  for (const feel of ["success", "warning", "ratchet"]) assert.equal(iphoneTicksOnTap(feel), false, `${feel} stays silent on an iPhone`);
});

test("a device is Android-like if it can vibrate, an iPhone if it cannot but is one, and otherwise has no haptics", () => {
  assert.equal(hapticKind({ hasVibrate: true, isIPhone: false, isAndroid: true }), "android");
  assert.equal(hapticKind({ hasVibrate: false, isIPhone: true, isAndroid: false }), "iphone");
  assert.equal(hapticKind({ hasVibrate: false, isIPhone: false, isAndroid: false }), "none");
  assert.equal(hapticKind({ hasVibrate: true, isIPhone: false, isAndroid: false }), "none", "Chrome on a computer has a vibrate function that does nothing");
});

test("the pull passes three notches that end at the lock-in", async () => {
  const { pullNotch } = await import("../src/lib/haptics.js");
  assert.deepEqual([0, 0.2, 1 / 3, 0.5, 2 / 3, 0.9, 1, 1.4].map(pullNotch), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(pullNotch(-1), 0);
});

test("a haptic is always felt on Android, even on a phone that turned the old Vibration switch off", async () => {
  await import("./helpers/typescript-renderer.mjs");
  const vibrations = [];
  const store = new Map();
  Object.defineProperty(globalThis, "window", { value: { localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) }, addEventListener() {}, removeEventListener() {} }, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Android", platform: "Linux", maxTouchPoints: 5, vibrate: (pattern) => { vibrations.push(pattern); return true; } }, configurable: true });
  const { haptic } = await import("../src/lib/haptics-client.ts");
  assert.match(haptic("tick"), /vibration 10 ms/);
  store.set("pickem-vibration", "off");
  assert.match(haptic("success"), /vibration 14-60-14 ms/, "the old switch's stored off no longer silences anything");
  assert.match(haptic("warning"), /vibration 50-70-50 ms/);
  assert.deepEqual(vibrations, [[10], [14, 60, 14], [50, 70, 50]]);
  delete globalThis.window;
});
