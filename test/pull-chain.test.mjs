import test from "node:test";
import assert from "node:assert/strict";
import { CHAIN_LENGTH, LEAD_TO, REAR_X, chainLinks, chainTwang, footSquash, FOOT, leadPose, ringPoint, rodHeight } from "../src/lib/pull-chain.js";

const GROUND = 56, ROD = rodHeight(60);

test("the lead rod comes in from above the header and plants at the far end, upright, when the pull reaches the threshold", () => {
  const start = leadPose(0, GROUND, ROD), end = leadPose(1, GROUND, ROD);
  assert.ok(start.y + ROD + FOOT < 0, "at the start the whole rod is above the top edge");
  assert.ok(start.tilt > 20, "carried at an angle");
  assert.equal(end.x, LEAD_TO);
  assert.equal(end.y, GROUND - ROD - FOOT, "its foot is on the ground");
  assert.equal(end.tilt, 0);
  assert.deepEqual(leadPose(5, GROUND, ROD), end, "pulling further changes nothing");
});

test("the chain is exactly taut when the rod has planted, and slack before", () => {
  const rear = ringPoint(REAR_X, GROUND - ROD - FOOT, 0, ROD);
  const planted = leadPose(1, GROUND, ROD), front = ringPoint(planted.x, planted.y, planted.tilt, ROD);
  assert.ok(Math.abs(Math.hypot(front.x - rear.x, front.y - rear.y) - CHAIN_LENGTH) < 1e-9);
  const half = leadPose(0.5, GROUND, ROD), halfFront = ringPoint(half.x, half.y, half.tilt, ROD);
  assert.ok(Math.hypot(halfFront.x - rear.x, halfFront.y - rear.y) < CHAIN_LENGTH - 20, "halfway there is plenty of slack");
});

test("a taut chain is a straight line of the same links, and slack lies in humps above the line between the rods", () => {
  const rear = { x: REAR_X, y: 50 }, front = { x: LEAD_TO, y: 50 };
  const taut = chainLinks(rear, front);
  assert.equal(taut.links.length, chainLinks({ x: REAR_X, y: 50 }, { x: 100, y: 50 }).links.length, "the same number of links however it lies");
  assert.ok(taut.links.every((link) => Math.abs(link.y - 50) < 1e-9), "straight");
  assert.deepEqual(taut.links.slice(0, 4).map((link) => link.edge), [false, true, false, true], "alternating face-on and edge-on");
  const slack = chainLinks(rear, { x: 100, y: 50 });
  assert.ok(slack.links.some((link) => link.y < 49), "humps rise above the line");
  assert.ok(slack.links.every((link) => link.y <= 50 + 1e-9), "and never dip below the ground-level line");
  assert.ok(Math.abs(slack.clip.x - (REAR_X + 100) / 2) < 3, "the clip marks the middle");
});

test("a twang bows the taut chain and dies away, struck again every 700 ms", () => {
  const taut = chainLinks({ x: REAR_X, y: 50 }, { x: LEAD_TO, y: 50 }, 4);
  assert.ok(taut.links.some((link) => link.y > 52), "the middle is pulled aside");
  assert.equal(chainTwang(0), 0);
  assert.ok(Math.abs(chainTwang(40)) > Math.abs(chainTwang(400)), "it dies away");
  assert.ok(Math.abs(chainTwang(700 + 40) - chainTwang(40)) < 1e-9, "and repeats");
});

test("the rubber foot compresses, rebounds a little past its resting height, and settles uncompressed", () => {
  assert.ok(Math.abs(footSquash(0) - 0.6) < 1e-9);
  assert.ok(footSquash(20) < 1, "squashed at first");
  assert.ok(footSquash(90) > 1, "then it rebounds past its resting height");
  assert.ok(Math.abs(footSquash(1500) - 1) < 1e-3);
});

test("the rod fits every header height the page can have", () => {
  for (const height of [44, 56, 60, 96]) assert.ok(rodHeight(height) >= 34 && rodHeight(height) <= 44 && rodHeight(height) + FOOT <= height - 4, String(height));
});
