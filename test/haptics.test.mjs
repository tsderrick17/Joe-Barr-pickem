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
  assert.equal(hapticKind({ hasVibrate: true, isIPhone: false }), "android");
  assert.equal(hapticKind({ hasVibrate: false, isIPhone: true }), "iphone");
  assert.equal(hapticKind({ hasVibrate: false, isIPhone: false }), "none");
});
