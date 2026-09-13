import test from "node:test";
import assert from "node:assert/strict";
import { isProbeHealthyAfterDebounce } from "../src/lib/health-probe-debounce.js";

test("critical-worker probe debounces a transient unhealthy check", () => {
  const firstFailure = "2026-09-13T20:00:00.000Z";
  assert.equal(isProbeHealthyAfterDebounce({ healthy: false, unhealthySince: firstFailure }, new Date("2026-09-13T20:09:59.999Z")), true);
  assert.equal(isProbeHealthyAfterDebounce({ healthy: false, unhealthySince: firstFailure }, new Date("2026-09-13T20:10:00.000Z")), false);
});

test("critical-worker probe recovers immediately after a healthy check", () => {
  assert.equal(isProbeHealthyAfterDebounce({ healthy: true, unhealthySince: "2026-09-13T19:00:00.000Z" }, new Date("2026-09-13T20:30:00.000Z")), true);
  assert.equal(isProbeHealthyAfterDebounce({ healthy: false, unhealthySince: null }, new Date("2026-09-13T20:30:00.000Z")), true);
});
