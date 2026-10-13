import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

const { bowlSeasonOpen, navTabsScript } = await import("../src/lib/nav-tabs.ts");

/** Runs the inline head script against a pretend page and returns the flags it set on <html>. */
function run(stored, now, launchMs) {
  const dataset = {};
  vm.runInNewContext(navTabsScript(launchMs), {
    document: { documentElement: { dataset } },
    localStorage: { getItem: () => stored },
    Date: { now: () => now },
    JSON,
  });
  return dataset;
}

test("the header's optional tabs are decided before the first paint", () => {
  const launch = Date.parse("2026-12-07T08:00:00Z");
  const before = Date.parse("2026-10-13T12:00:00Z");
  assert.deepEqual(run(null, before, launch), {}, "first visit before Bowl season: Standings and the Slate only");
  assert.deepEqual(run(null, launch + 1, launch), { navBowls: "1" }, "Bowl season opens NCAA Bowls for everybody");
  assert.deepEqual(run(JSON.stringify({ bowls: true, commissioner: true }), before, launch), { navBowls: "1", navCommissioner: "1" }, "a commissioner's tabs are remembered");
  assert.deepEqual(run("not json", before, launch), {}, "a damaged memory is ignored, never an error");
});

test("Bowl season opens on December 7 at 3 AM Eastern", () => {
  assert.equal(bowlSeasonOpen(new Date("2026-12-07T07:59:00Z")), false);
  assert.equal(bowlSeasonOpen(new Date("2026-12-07T08:00:00Z")), true);
  assert.equal(bowlSeasonOpen(new Date("2027-01-15T12:00:00Z")), true, "still open through the bowls");
  assert.equal(bowlSeasonOpen(new Date("2027-08-02T12:00:00Z")), false, "a new season starts closed");
});
