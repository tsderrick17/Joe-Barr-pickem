import test from "node:test";
import assert from "node:assert/strict";
import { bowlPoolPrelaunchHealthResult } from "../src/lib/bowl-pool-health-gate.js";

const season = {
  player_visible_at: "2026-12-07T08:00:00.000Z",
  first_kickoff_at: "2026-12-18T16:00:00.000Z",
};

test("the Bowl monitor tolerates setup only before player visibility", () => {
  assert.deepEqual(
    bowlPoolPrelaunchHealthResult(season, new Date("2026-12-07T07:59:59.999Z")),
    { configured: true, healthy: true, problems: [], integrity: null, settlement: null },
  );
  assert.equal(bowlPoolPrelaunchHealthResult(season, new Date(season.player_visible_at)), null);
});

test("Bowl integrity checks are required before first kickoff once players can see the pool", () => {
  assert.equal(bowlPoolPrelaunchHealthResult(season, new Date("2026-12-10T12:00:00.000Z")), null);
  assert.equal(bowlPoolPrelaunchHealthResult(season, new Date(season.first_kickoff_at)), null);
});
