import assert from "node:assert/strict";
import test from "node:test";
import {
  SPOKES, dialGeometry, dialPlace, dragPosition, nearestTurn, needsYou, releaseTarget, spokeIndexForPath, spokeStatus, swingAt, wrap,
} from "../src/lib/commissioner-wheel.js";

const stage = (id, state, label = id) => ({ id, state, label, detail: `${label} detail` });
const calm = { stages: [stage("schedule", "complete"), stage("lines", "complete"), stage("scores", "active", "Games & scoring")], openIncidentCount: 0 };

test("every spoke has its own address and every address finds its spoke", () => {
  assert.equal(new Set(SPOKES.map((spoke) => spoke.href)).size, SPOKES.length);
  SPOKES.forEach((spoke, index) => {
    assert.equal(spokeIndexForPath(spoke.href), index);
    assert.equal(spokeIndexForPath(`${spoke.href}/`), index);
  });
  assert.equal(spokeIndexForPath("/admin"), -1);
  assert.equal(spokeIndexForPath("/admin/players-old"), -1);
  assert.equal(spokeIndexForPath("/"), -1);
});

test("the Email center and the Players page keep their old addresses", () => {
  assert.equal(SPOKES[spokeIndexForPath("/admin/reminders")].name, "Messages");
  assert.equal(SPOKES[spokeIndexForPath("/admin/players")].name, "Players");
});

test("with no map every spoke is idle and nothing needs you", () => {
  assert.ok(Object.values(spokeStatus(null)).every((status) => status.state === "idle" && status.count === 0));
  assert.deepEqual(needsYou(null), []);
});

test("a calm map lights Game day, Season and Health green", () => {
  const status = spokeStatus(calm);
  assert.equal(status.gameday.state, "ok");
  assert.equal(status.gameday.line, "Now: Games & scoring");
  assert.equal(status.season.state, "ok");
  assert.equal(status.health.state, "ok");
  assert.equal(status.players.state, "idle");
  assert.deepEqual(needsYou(calm), []);
});

test("a stage needing attention marks its spoke and lands in Needs you with a way there", () => {
  const map = { stages: [stage("schedule", "attention", "Schedule"), stage("scores", "attention", "Games & scoring")], openIncidentCount: 0 };
  const status = spokeStatus(map);
  assert.deepEqual([status.gameday.state, status.gameday.count], ["warn", 1]);
  assert.deepEqual([status.season.state, status.season.count], ["warn", 1]);
  assert.deepEqual(needsYou(map).map((item) => [item.title, item.href]), [["Schedule", "/admin/season"], ["Games & scoring", "/admin/gameday"]]);
});

test("open incidents turn Health red and add one Needs you line", () => {
  const map = { ...calm, openIncidentCount: 2 };
  assert.deepEqual([spokeStatus(map).health.state, spokeStatus(map).health.count, spokeStatus(map).health.line], ["bad", 2, "2 open incidents"]);
  assert.deepEqual(needsYou(map).map((item) => [item.title, item.href, item.state]), [["2 open watchdog incidents", "/admin/health", "bad"]]);
});

test("odds credits show what is used and warn near the limit", () => {
  assert.deepEqual(spokeStatus({ ...calm, providerCreditSnapshot: { used: 88, limit: 500 } }).odds, { state: "ok", count: 0, line: "88 of 500 used" });
  assert.equal(spokeStatus({ ...calm, providerCreditSnapshot: { used: 450, limit: 500 } }).odds.state, "warn");
});

test("the dial wraps round both ways", () => {
  assert.equal(wrap(10), 0);
  assert.equal(wrap(-1), 9);
  assert.equal(nearestTurn(9, 0), -1);
  assert.equal(nearestTurn(0, 9), 10);
});

test("the current page sits in the centre, largest, and far spokes are hidden", () => {
  const geometry = { ...dialGeometry(390), radius: 380 };
  const centre = dialPlace(3, 3, geometry);
  assert.deepEqual([centre.x, centre.y, centre.scale, centre.reachable], [0, 0, 1.2, true]);
  const right = dialPlace(4, 3, geometry), left = dialPlace(2, 3, geometry);
  assert.ok(right.x > 0 && left.x < 0 && right.y > 0, "neighbours sit either side, a little lower on the arc");
  assert.ok(right.scale < centre.scale);
  assert.equal(dialPlace(8, 3, geometry).reachable, false);
  assert.equal(dialPlace(8, 3, geometry).opacity, 0);
});

test("a phone shows two neighbours a side, a computer three", () => {
  assert.equal(dialGeometry(390).visible, 2);
  assert.equal(dialGeometry(1280).visible, 3);
  assert.ok(dialGeometry(320).gap >= 36);
});

test("dragging left turns the dial to later pages", () => {
  assert.equal(dragPosition(3, -64, 64), 4);
  assert.equal(dragPosition(3, 128, 64), 1);
});

test("letting go opens the nearest page, a slide up cancels, and a quick flick moves one", () => {
  assert.equal(releaseTarget({ current: 3, nearest: 5, moved: true }), 5);
  assert.equal(releaseTarget({ current: 3, nearest: 5, moved: true, cancelled: true }), 3);
  assert.equal(releaseTarget({ current: 3, nearest: 3, moved: true, velocity: -0.8 }), 4);
  assert.equal(releaseTarget({ current: 3, nearest: 3, moved: true, velocity: 0.8 }), 2);
  assert.equal(releaseTarget({ current: 3, nearest: 3, moved: true, velocity: 0.2 }), 3);
  assert.equal(releaseTarget({ current: 0, nearest: 0, moved: true, velocity: 0.9 }), 9);
  assert.equal(releaseTarget({ current: 3, nearest: 5, moved: false }), 3);
});

test("the settle swings past and comes to rest on the page", () => {
  assert.equal(swingAt(4, 3, 0), 3);
  assert.ok([0.2, 0.3, 0.4].some((seconds) => swingAt(4, 3, seconds) > 4), "it swings past");
  assert.ok(Math.abs(swingAt(4, 3, 1.2) - 4) < 0.01);
  assert.equal(swingAt(4, 3, 1.5), 4);
});
