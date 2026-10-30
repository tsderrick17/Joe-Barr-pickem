import assert from "node:assert/strict";
import test from "node:test";
import { androidPattern, FEELS, hapticKind, iphoneTickPlan } from "../src/lib/haptics.js";

test("every feel has a vibration pattern; a saved double tap and a warning are felt differently from a tick", () => {
  for (const feel of FEELS) assert.ok(androidPattern(feel).length >= 1 && androidPattern(feel).every((ms) => ms > 0), feel);
  assert.equal(androidPattern("success").length, 3, "two taps with a gap");
  assert.ok(androidPattern("warning").reduce((a, b) => a + b) > androidPattern("success").reduce((a, b) => a + b), "a warning is longer than a success");
  assert.ok(androidPattern("lockIn")[0] > androidPattern("tick")[0], "a lock-in is firmer than a tick");
  assert.ok(androidPattern("lightTick")[0] < androidPattern("tick")[0], "taking a pick back is lighter than choosing");
});

test("an iPhone only gets a feel at the tap itself: ticks for choices, two for a lock-in, nothing later", () => {
  assert.deepEqual(iphoneTickPlan("tick"), { ticks: 1, gapMs: 0 });
  assert.deepEqual(iphoneTickPlan("lightTick"), { ticks: 1, gapMs: 0 });
  assert.deepEqual(iphoneTickPlan("lockIn"), { ticks: 2, gapMs: 35 });
  for (const feel of ["success", "warning", "ratchet"]) assert.equal(iphoneTickPlan(feel).ticks, 0, `${feel} stays silent on an iPhone`);
  for (const feel of ["success", "warning", "ratchet"]) assert.equal(iphoneTickPlan(feel, true).ticks, 1, `${feel} is tried once when the Feel test asks`);
});

test("a device is Android-like if it can vibrate, an iPhone if it cannot but is one, and otherwise has no haptics", () => {
  assert.equal(hapticKind({ hasVibrate: true, isIPhone: false }), "android");
  assert.equal(hapticKind({ hasVibrate: false, isIPhone: true }), "iphone");
  assert.equal(hapticKind({ hasVibrate: false, isIPhone: false }), "none");
});
