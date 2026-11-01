import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

const { bowlSeasonOpen, navTabsScript } = await import("../src/lib/nav-tabs.ts");

/** Runs the inline head script against a pretend page and returns the flags it set on <html>. */
function run(stored, now) {
  const dataset = {};
  vm.runInNewContext(navTabsScript(), {
    document: { documentElement: { dataset } },
    localStorage: { getItem: () => stored },
    Date: { now: () => now, UTC: Date.UTC },
    JSON,
  });
  return dataset;
}

test("the header's optional tabs are decided before the first paint", () => {
  const launch = Date.parse("2026-12-07T08:00:00Z");
  const before = Date.parse("2026-10-13T12:00:00Z");
  assert.deepEqual(run(null, before), {}, "first visit before Bowl season: Standings and the Slate only");
  assert.deepEqual(run(null, launch + 1), { navBowls: "1" }, "Bowl season opens NCAA Bowls for everybody");
  assert.deepEqual(run(JSON.stringify({ bowls: true, commissioner: true }), before), { navBowls: "1", navCommissioner: "1" }, "a commissioner's tabs are remembered");
  assert.deepEqual(run("not json", before), {}, "a damaged memory is ignored, never an error");
});

test("the inline script follows the season the browser is in, not the season the page was built in", () => {
  // The same built script, opened in three different seasons: it always agrees with bowlSeasonOpen().
  const instants = [
    "2026-12-07T07:59:59Z", "2026-12-07T08:00:00Z", "2027-01-20T12:00:00Z", "2027-07-31T23:59:59Z", "2027-08-01T03:59:59Z", "2027-08-01T04:00:00Z",
    "2027-12-07T07:59:59Z", "2027-12-07T08:00:00Z", "2028-02-10T12:00:00Z", "2028-12-06T12:00:00Z", "2028-12-07T08:00:00Z", "2035-12-07T08:00:00Z", "2035-12-07T07:00:00Z",
  ];
  for (const iso of instants) assert.equal(run(null, Date.parse(iso)).navBowls === "1", bowlSeasonOpen(new Date(iso)), iso);
  assert.deepEqual(run(null, Date.parse("2027-10-01T12:00:00Z")), {}, "next fall the tab is closed until next December 7, not open all year");
  assert.deepEqual(run(null, Date.parse("2027-12-07T08:00:00Z")), { navBowls: "1" });
});

test("Bowl season opens on December 7 at 3 AM Eastern", () => {
  assert.equal(bowlSeasonOpen(new Date("2026-12-07T07:59:00Z")), false);
  assert.equal(bowlSeasonOpen(new Date("2026-12-07T08:00:00Z")), true);
  assert.equal(bowlSeasonOpen(new Date("2027-01-15T12:00:00Z")), true, "still open through the bowls");
  assert.equal(bowlSeasonOpen(new Date("2027-08-02T12:00:00Z")), false, "a new season starts closed");
});
