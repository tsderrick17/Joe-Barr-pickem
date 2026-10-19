import test from "node:test";
import assert from "node:assert/strict";
import { ballSpot, chainLinks, chainTwang, fieldMarks, footSquash, FOOT, groundOf, layout, leadPose, ringPoint, rodHeight, strainLean, TURF } from "../src/lib/pull-chain.js";

const HEIGHT = 60, GROUND = groundOf(HEIGHT), ROD = rodHeight(HEIGHT);
const PHONE = layout(390);
const ringsAt = (progress, lay = PHONE) => {
  const rear = ringPoint(lay.rear, GROUND - ROD - FOOT, 0, ROD);
  const pose = leadPose(progress, GROUND, ROD, lay);
  return { rear, front: ringPoint(pose.x, pose.y, pose.tilt, ROD), pose };
};
const chain = (progress, extra = {}, lay = PHONE) => { const { rear, front } = ringsAt(progress, lay); return chainLinks(rear, front, { chainLength: lay.chainLength, groundY: GROUND, ...extra }); };

test("the scene is as wide as the page, with the rods a chain (ten yards) apart once the lead rod has planted", () => {
  for (const width of [320, 390, 430, 768]) {
    const lay = layout(width);
    assert.equal(lay.width, width);
    assert.ok(lay.leadTo - lay.rear > width * 0.75, "the chain spans most of the page");
    assert.equal(lay.chainLength, lay.leadTo - lay.rear);
    assert.ok(Math.abs(lay.yard * 10 - lay.chainLength) < 1e-9, "ten yards");
  }
});

test("the lead rod comes in from above the header and plants at the far end, upright, when the pull reaches the threshold", () => {
  const start = leadPose(0, GROUND, ROD, PHONE), end = leadPose(1, GROUND, ROD, PHONE);
  assert.ok(start.y + ROD + FOOT < 0, "at the start the whole rod is above the top edge");
  assert.ok(start.tilt > 20, "carried at an angle");
  assert.equal(end.x, PHONE.leadTo);
  assert.equal(end.y, GROUND - ROD - FOOT, "its foot is on the ground");
  assert.equal(end.tilt, 0);
  assert.deepEqual(leadPose(5, GROUND, ROD, PHONE), end, "pulling further changes nothing");
});

test("the chain is exactly taut when the rod has planted, and has plenty of slack before", () => {
  const { rear, front } = ringsAt(1);
  assert.ok(Math.abs(Math.hypot(front.x - rear.x, front.y - rear.y) - PHONE.chainLength) < 1e-9);
  assert.equal(chain(1).taut, true);
  assert.equal(chain(0.5).taut, false);
  assert.ok(chain(0.5).slack > 20);
});

test("slack chain lies on the turf in a heap and is paid out as the rod moves away: the heap shrinks, the slack falls, the chain only ever lies flat or runs straight", () => {
  const slack = [0.1, 0.3, 0.5, 0.7, 0.9].map((progress) => chain(progress).slack);
  for (let i = 1; i < slack.length; i += 1) assert.ok(slack[i] < slack[i - 1], "less slack every time");
  const floor = GROUND - 2.2;
  for (const progress of [0.1, 0.5, 0.9]) {
    const { links } = chain(progress);
    const lifted = links.filter((link) => link.y < floor - 5);
    assert.ok(links.every((link) => link.y <= floor + 1.6), "nothing sinks into the turf");
    // whatever is lifted off the turf is the straight run up to the lead rod's ring, never ahead of it and never a hump hanging in the air
    const { rear, front } = ringsAt(progress);
    for (const link of lifted) assert.ok(link.x >= rear.x && link.x <= front.x + 0.5, "lifted links lie between the rods");
  }
});

test("the links alternate face-on and edge-on, there are always the same number, and a taut chain is a straight line", () => {
  const taut = chain(1), loose = chain(0.2);
  assert.equal(taut.links.length, loose.links.length);
  assert.deepEqual(taut.links.slice(0, 4).map((link) => link.edge), [false, true, false, true]);
  const { rear, front } = ringsAt(1);
  const slope = (front.y - rear.y) / (front.x - rear.x);
  for (const link of taut.links) assert.ok(Math.abs(link.y - (rear.y + slope * (link.x - rear.x))) < 1e-6, "on the line");
  assert.ok(Math.abs(taut.clip.x - (rear.x + front.x) / 2) < 3, "the clip marks the middle");
});

test("a twang bows the taut chain and dies away, struck again every 700 ms", () => {
  const bowed = chain(1, { twang: 4 }), still = chain(1);
  const middle = (c) => c.links[Math.floor(c.links.length / 2)].y;
  assert.ok(middle(bowed) - middle(still) > 2.5, "the middle is pulled aside");
  assert.equal(chainTwang(0), 0);
  assert.ok(Math.abs(chainTwang(40)) > Math.abs(chainTwang(400)), "it dies away");
  assert.ok(Math.abs(chainTwang(700 + 40) - chainTwang(40)) < 1e-9, "and repeats");
});

test("the planted rod leans against the strain and settles upright", () => {
  assert.ok(Math.abs(strainLean(0) - 5) < 1e-9);
  assert.ok(Math.abs(strainLean(2000)) < 0.01);
});

test("the rubber foot compresses, rebounds a little past its resting height, and settles uncompressed", () => {
  assert.ok(Math.abs(footSquash(0) - 0.6) < 1e-9);
  assert.ok(footSquash(20) < 1, "squashed at first");
  assert.ok(footSquash(90) > 1, "then it rebounds past its resting height");
  assert.ok(Math.abs(footSquash(1500) - 1) < 1e-3);
});

test("the football is spotted at the lead rod, and its nose is a couple of inches past the rod's near edge: a first down", () => {
  for (const width of [320, 390, 430]) {
    const lay = layout(width), ball = ballSpot(lay, HEIGHT);
    const rodNearEdge = lay.leadTo - 3.1;
    const inches = (ball.nose - rodNearEdge) / (lay.yard / 36);   // a yard is 36 inches
    assert.ok(ball.nose > rodNearEdge, "past the rod's near edge");
    assert.ok(inches > 0 && inches < 6, `a couple of inches, not feet (${inches.toFixed(1)} in at ${width} px)`);
    assert.ok(ball.x + ball.length / 2 === ball.nose, "pointing toward the rod");
    assert.ok(ball.y - ball.height / 2 >= HEIGHT - TURF, "on the field, inside the strip of turf");
  }
});

test("the field has a yard line every five yards and a hash mark on each yard between them, across the whole page", () => {
  const lay = layout(390), marks = fieldMarks(lay);
  const gaps = marks.lines.slice(1).map((x, i) => x - marks.lines[i]);
  assert.ok(gaps.every((gap) => Math.abs(gap - lay.yard * 5) < 1e-9), "five yards apart");
  assert.ok(marks.lines[0] < lay.yard * 5 && marks.lines.at(-1) > lay.width - lay.yard * 5, "from edge to edge");
  assert.ok(marks.hashes.length >= 8, "a hash mark every yard");
  assert.ok(marks.hashes.slice(1).every((x, i) => [lay.yard, lay.yard * 2].some((gap) => Math.abs(x - marks.hashes[i] - gap) < 1e-9)), "one yard apart, or two where a yard line sits between");
  assert.ok(marks.hashes.every((x) => !marks.lines.some((line) => Math.abs(line - x) < 1e-6)), "no hash mark sits on a yard line");
});

test("the rod fits every header height the page can have, above the turf", () => {
  for (const height of [44, 56, 60, 96]) assert.ok(rodHeight(height) >= 24 && rodHeight(height) <= 44 && rodHeight(height) + FOOT + TURF - 3 <= height, String(height));
});
