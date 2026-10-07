import assert from "node:assert/strict";
import test from "node:test";
import {
  FAST_GRADING_REFRESH_MS,
  QUIET_GRADING_REFRESH_MS,
  gradingRefreshInterval,
} from "../src/lib/grading-refresh-policy.js";

const now = Date.parse("2026-10-04T17:00:00.000Z");
const quiet = { metrics: { live: 0 }, attention: [], games: [] };

test("grading checks quickly before its first response and during active work", () => {
  assert.equal(gradingRefreshInterval(null, now), FAST_GRADING_REFRESH_MS);
  assert.equal(gradingRefreshInterval({ ...quiet, metrics: { live: 1 } }, now), FAST_GRADING_REFRESH_MS);
  assert.equal(gradingRefreshInterval({ ...quiet, attention: [{}] }, now), FAST_GRADING_REFRESH_MS);
});

test("quiet grading uses a 15-minute interval", () => {
  assert.equal(QUIET_GRADING_REFRESH_MS, 15 * 60_000);
  assert.equal(gradingRefreshInterval(quiet, now), QUIET_GRADING_REFRESH_MS);
  assert.equal(gradingRefreshInterval({ ...quiet, games: [{ state: "settled", kickoffAt: new Date(now).toISOString() }] }, now), QUIET_GRADING_REFRESH_MS);
});

test("scheduled kickoff within 15 minutes in either direction uses fast refresh", () => {
  for (const offsetMinutes of [-15, -1, 0, 1, 15]) {
    const data = { ...quiet, games: [{ state: "scheduled", kickoffAt: new Date(now + offsetMinutes * 60_000).toISOString() }] };
    assert.equal(gradingRefreshInterval(data, now), FAST_GRADING_REFRESH_MS);
  }
  for (const offsetMinutes of [-16, 16]) {
    const data = { ...quiet, games: [{ state: "scheduled", kickoffAt: new Date(now + offsetMinutes * 60_000).toISOString() }] };
    assert.equal(gradingRefreshInterval(data, now), QUIET_GRADING_REFRESH_MS);
  }
});

test("invalid kickoff timestamps do not force costly fast polling", () => {
  assert.equal(
    gradingRefreshInterval({ ...quiet, games: [{ state: "scheduled", kickoffAt: "invalid" }] }, now),
    QUIET_GRADING_REFRESH_MS,
  );
});
