import test from "node:test";
import assert from "node:assert/strict";
import { ballSpot, chainLinks, chainTwang, fieldMarks, footSquash, FOOT, groundOf, layout, leadPose, poleLength, ringPoint, strainLean, TURF } from "../src/lib/pull-chain.js";

const HEIGHT = 60, GROUND = groundOf(HEIGHT);
const PHONE = layout(390);
const ringsAt = (progress, lay = PHONE) => {
  const rear = ringPoint(lay.rear, GROUND - poleLength(lay), 0, lay);
  const pose = leadPose(progress, GROUND, lay);
  return { rear, front: ringPoint(pose.x, pose.y, pose.tilt, lay), pose };
};
const chain = (progress, extra = {}, lay = PHONE) => { const { rear, front } = ringsAt(progress, lay); return chainLinks(rear, front, { chainLength: lay.chainLength, groundY: GROUND, linkZoom: lay.linkZoom, ...extra }); };

test("the scene shows three yards across the page, as wide as the page, with a ten-yard chain whose far end is the lead pole", () => {
  for (const width of [320, 390, 430, 768]) {
    const lay = layout(width);
    assert.ok(Math.abs(lay.yard * 3 - width) < 1e-9, "three yards across");
    assert.ok(Math.abs(lay.chainLength - lay.yard * 10) < 1e-9, "a ten-yard chain");
    assert.ok(lay.leadTo > width * 0.6 && lay.leadTo < width * 0.85, "the lead pole plants toward the right");
    assert.ok(lay.rear < -lay.yard * 5, "the rear pole and the heap of slack are far off the page to the left");
    assert.ok(Math.abs(lay.leadTo - lay.rear - lay.chainLength) < 1e-9);
  }
});

test("only the bottom third of the pole fits in the header: the pole is about three times as tall as the space above its foot", () => {
  const pole = poleLength(PHONE), above = GROUND;   // from the foot to the top of the header
  assert.ok(pole / above > 2.4 && pole / above < 3.6, `pole ${pole}px against ${above}px of header`);
});

test("the lead pole comes in from above the header and plants at its place, upright, when the pull reaches the threshold", () => {
  const start = leadPose(0, GROUND, PHONE), end = leadPose(1, GROUND, PHONE);
  assert.ok(start.y + poleLength(PHONE) < 0, "at the start the whole pole is above the top edge");
  assert.ok(start.tilt > 20, "carried at an angle");
  assert.equal(end.x, PHONE.leadTo);
  assert.equal(end.y, GROUND - poleLength(PHONE), "its foot is on the ground");
  assert.equal(end.tilt, 0);
  assert.deepEqual(leadPose(5, GROUND, PHONE), end, "pulling further changes nothing");
});

test("the chain is exactly taut when the pole has planted, and has slack before, to be used up as it is dragged across", () => {
  const { rear, front } = ringsAt(1);
  assert.ok(Math.abs(Math.hypot(front.x - rear.x, front.y - rear.y) - PHONE.chainLength) < 1e-6);
  assert.equal(chain(1).taut, true);
  assert.equal(chain(0.5).taut, false);
  const slack = [0.1, 0.3, 0.5, 0.7, 0.9].map((progress) => chain(progress).slack);
  for (let i = 1; i < slack.length; i += 1) assert.ok(slack[i] < slack[i - 1], "less slack every time");
});

test("the chain lies on the turf and is dragged across it: links near the visible edge move toward the pole as slack is used up, and none sinks into the turf", () => {
  const floor = GROUND - 2.2 * PHONE.linkZoom;
  const visible = (progress) => chain(progress).links.filter((link) => link.x > 0 && link.x < PHONE.width);
  for (const progress of [0.1, 0.5, 0.9]) {
    assert.ok(visible(progress).length > 10, "a good run of chain is on the page");
    assert.ok(chain(progress).links.every((link) => link.y <= floor + 1.6 * PHONE.linkZoom), "nothing sinks into the turf");
  }
  const { front } = ringsAt(0.5);
  for (const link of chain(0.5).links.filter((l) => l.y < floor - 8)) assert.ok(link.x <= front.x + 0.5, "lifted links are the straight run up to the pole, never ahead of it");
});

test("the links alternate face-on and edge-on, there are always the same number, and a taut chain is a straight line", () => {
  const taut = chain(1), loose = chain(0.2);
  assert.equal(taut.links.length, loose.links.length);
  assert.deepEqual(taut.links.slice(0, 4).map((link) => link.edge), [false, true, false, true]);
  const { rear, front } = ringsAt(1);
  const slope = (front.y - rear.y) / (front.x - rear.x);
  for (const link of taut.links) assert.ok(Math.abs(link.y - (rear.y + slope * (link.x - rear.x))) < 1e-6, "on the line");
  assert.ok(Math.abs(taut.clip.x - (rear.x + front.x) / 2) < 12, "the clip marks the middle (off the page to the left)");
});

test("a twang bows the taut chain and dies away, struck again every 700 ms", () => {
  const bowed = chain(1, { twang: 8 }), still = chain(1);
  const near = (c) => c.links[Math.floor(c.links.length * 0.8)].y;   // toward the pole, where the page shows it
  assert.ok(near(bowed) - near(still) > 1, "the chain near the pole is pulled aside");
  assert.equal(chainTwang(0), 0);
  assert.ok(Math.abs(chainTwang(40)) > Math.abs(chainTwang(400)), "it dies away");
  assert.ok(Math.abs(chainTwang(700 + 40) - chainTwang(40)) < 1e-9, "and repeats");
});

test("the planted pole leans against the strain and settles upright", () => {
  assert.ok(Math.abs(strainLean(0) - 4) < 1e-9);
  assert.ok(Math.abs(strainLean(2000)) < 0.01);
});

test("the rubber foot compresses, rebounds a little past its resting height, and settles uncompressed", () => {
  assert.ok(Math.abs(footSquash(0) - 0.6) < 1e-9);
  assert.ok(footSquash(20) < 1, "squashed at first");
  assert.ok(footSquash(90) > 1, "then it rebounds past its resting height");
  assert.ok(Math.abs(footSquash(1500) - 1) < 1e-3);
});

test("the football is spotted at the lead pole and its tip pokes out a couple of inches past the pole's foot: a first down", () => {
  for (const width of [320, 390, 430]) {
    const lay = layout(width), ball = ballSpot(lay, HEIGHT);
    const footFarEdge = lay.leadTo + 3.1 * lay.zoom;
    const inches = (ball.nose - footFarEdge) / lay.inch;
    assert.ok(ball.nose > footFarEdge, "past the pole's foot");
    assert.ok(inches > 1.5 && inches < 4, `a couple of inches, not feet (${inches.toFixed(1)} in at ${width} px)`);
    assert.equal(ball.x + ball.length / 2, ball.nose, "pointing toward the defense");
    assert.ok(ball.nose < width, "inside the page, at the right");
    assert.ok(ball.y - ball.height / 2 >= HEIGHT - TURF, "on the field, inside the strip of turf");
    assert.ok(ball.length < lay.yard * 0.6, "a ball is a fraction of a yard long");
  }
});

test("the field has a yard line every five yards and a hash mark on each yard between them, across the page", () => {
  const lay = layout(390), marks = fieldMarks(lay);
  assert.ok(marks.hashes.length >= 2, "hash marks show at three yards across");
  assert.ok(marks.hashes.every((x) => x > -2 && x < lay.width + 2));
  assert.ok(marks.hashes.slice(1).every((x, i) => [lay.yard, lay.yard * 2].some((gap) => Math.abs(x - marks.hashes[i] - gap) < 1e-9)), "one yard apart, or two where a yard line sits between");
  assert.ok(marks.hashes.every((x) => !marks.lines.some((line) => Math.abs(line - x) < 1e-6)), "no hash mark sits on a yard line");
  const wide = fieldMarks(layout(1000));
  assert.ok(wide.lines.length >= 1, "a yard line is on the page now and then");
});

test("the foot and the turf fit inside the header", () => {
  for (const height of [44, 56, 60, 96]) assert.ok(TURF + 6 <= height && FOOT * PHONE.zoom < height, String(height));
});
