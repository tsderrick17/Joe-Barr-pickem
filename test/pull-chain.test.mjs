import test from "node:test";
import assert from "node:assert/strict";
import { PUFF_AT, ballSpot, chainAnchor, chainLinks, chainReach, counterSpot, descentPose, fieldMarks, footSquash, FOOT, groundOf, landingLean, layout, plantedPose, poleLength, pullStages, slatOffsets, TURF } from "../src/lib/pull-chain.js";

const HEIGHT = 60, GROUND = groundOf(HEIGHT);
const PHONE = layout(390);
const chainAt = (descent, lay = PHONE) => {
  const pose = descentPose(descent, lay, GROUND);
  return { pose, ...chainLinks(chainAnchor(lay, GROUND), pose.ring, { chainLength: chainReach(lay), groundY: GROUND, linkZoom: lay.linkZoom }) };
};

test("the scene shows three yards across the page, with the chain fastened at the page's left edge and reaching the lead pole", () => {
  for (const width of [320, 390, 430, 768]) {
    const lay = layout(width);
    assert.ok(Math.abs(lay.yard * 3 - width) < 1e-9, "three yards across");
    assert.ok(lay.leadTo > width * 0.6 && lay.leadTo < width * 0.85, "the lead pole lands toward the right");
    assert.ok(lay.anchorX <= 0, "the chain's fixed end is at (or just off) the left edge");
    assert.ok(Math.abs(chainReach(lay) - (lay.leadTo - lay.anchorX)) < 1e-9);
  }
});

test("only the bottom third of the pole fits in the header: the pole is about three times as tall as the space above its foot", () => {
  const pole = poleLength(PHONE), above = GROUND;   // from the foot to the top of the header
  assert.ok(pole / above > 2.4 && pole / above < 3.6, `pole ${pole}px against ${above}px of header`);
});

test("a pull has two stages: the pole comes down for the first half, then the counter turns for the second", () => {
  assert.deepEqual(pullStages(0), { descent: 0, counter: 0 });
  assert.deepEqual(pullStages(PUFF_AT), { descent: 1, counter: 0 });
  assert.deepEqual(pullStages(1), { descent: 1, counter: 1 });
  assert.deepEqual(pullStages(3), { descent: 1, counter: 1 }, "pulling further changes nothing");
  assert.deepEqual(pullStages(-1), { descent: 0, counter: 0 });
  assert.ok(Math.abs(pullStages(0.25).descent - 0.5) < 1e-9 && pullStages(0.25).counter === 0, "the counter has not started while the pole is still coming down");
  assert.ok(Math.abs(pullStages(0.75).counter - 0.5) < 1e-9 && pullStages(0.75).descent === 1, "and the pole stays down while the counter turns");
});

test("the chain is always straight and taut, rising about 15 degrees at the start and lying flat when the foot lands, and its reach grows as it lowers", () => {
  const anchor = chainAnchor(PHONE, GROUND), reach = chainReach(PHONE);
  let previousReach = 0, previousHeight = Infinity;
  for (const descent of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const { pose, links } = chainAt(descent);
    const length = Math.hypot(pose.ring.x - anchor.x, pose.ring.y - anchor.y);
    assert.ok(Math.abs(length - reach) < 1e-6, `the chain keeps its length at ${descent}: the ring turns about the fixed end`);
    const slope = (pose.ring.y - anchor.y) / (pose.ring.x - anchor.x);
    for (const link of links) assert.ok(Math.abs(link.y - (anchor.y + slope * (link.x - anchor.x))) < 1e-6, "every link on the straight line (taut: no slack, nothing dragging)");
    const horizontal = pose.ring.x - anchor.x, height = anchor.y - pose.ring.y;
    assert.ok(horizontal > previousReach, "the reach grows as the pole lowers");
    assert.ok(height < previousHeight, "and the ring comes down");
    previousReach = horizontal; previousHeight = height;
  }
  const start = chainAt(0).pose.ring;
  const degrees = (Math.atan2(anchor.y - start.y, start.x - anchor.x) * 180) / Math.PI;
  assert.ok(Math.abs(degrees - 15) < 0.01, `rising 15 degrees at the start (${degrees.toFixed(2)})`);
  assert.ok(start.x < PHONE.leadTo - 5, "the ring hangs short of the ball, and above it");
  const end = chainAt(1).pose.ring;
  assert.ok(Math.abs(end.y - anchor.y) < 1e-9 && Math.abs(end.x - PHONE.leadTo) < 1e-9, "flat, and the ring arrives at the ball only as the foot lands");
});

test("the pole comes in foot first from above the header, straightening as it lowers, and lands exactly at the ball, upright", () => {
  const start = descentPose(0, PHONE, GROUND), middle = descentPose(0.5, PHONE, GROUND), end = descentPose(1, PHONE, GROUND);
  assert.ok(start.foot.y <= 1, "at the start even the foot is at or above the top edge of the header: it comes in from above");
  assert.ok(start.lean > 15 && start.foot.x > start.top.x, "leaning, the foot ahead of the top");
  assert.ok(start.lean > middle.lean && middle.lean > end.lean, "straightening as it lowers, not afterwards");
  for (const [a, b] of [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]]) assert.ok(descentPose(b, PHONE, GROUND).foot.y > descentPose(a, PHONE, GROUND).foot.y, "the foot only ever goes down");
  assert.ok(Math.abs(end.lean) < 1e-9, "upright when it lands");
  assert.ok(Math.abs(end.foot.x - PHONE.leadTo) < 1e-9 && Math.abs(end.foot.y - GROUND) < 1e-9, "its foot is on the ground at the ball");
});

test("the landing: the pole swings once a little past upright and settles, the foot never moves, and the foot is squashed at contact and eases back up", () => {
  assert.equal(landingLean(0), 0, "upright at the instant of landing");
  let farthest = 0, previous = 0, turned = false;
  for (let since = 5; since <= 2000; since += 5) {
    const lean = landingLean(since);
    assert.ok(lean <= 1e-12, "only ever past upright (its top ahead), never swaying back the other way");
    if (Math.abs(lean) > Math.abs(farthest)) farthest = lean;
    if (Math.abs(lean) < Math.abs(previous)) turned = true;
    else assert.ok(!turned, `one swing out and one swing back (${since} ms)`);
    previous = lean;
  }
  assert.ok(farthest < -2 && farthest > -4, `a tad, not a lurch (${farthest.toFixed(2)} degrees)`);
  assert.ok(Math.abs(landingLean(3000)) < 0.01, "and it settles");
  for (const since of [0, 40, 130, 400, 1500]) {
    const pose = plantedPose(landingLean(since), PHONE, GROUND);
    assert.ok(Math.abs(pose.foot.x - PHONE.leadTo) < 1e-9 && Math.abs(pose.foot.y - GROUND) < 1e-9, `the foot has not moved ${since} ms after landing`);
  }
  assert.ok(Math.abs(footSquash(0) - 0.6) < 1e-9 && Math.abs(footSquash(3000) - 1) < 1e-3);
  let before = footSquash(0);
  for (let since = 5; since <= 1500; since += 5) { const now = footSquash(since); assert.ok(now >= before - 1e-12 && now <= 1); before = now; }
});

test("the links alternate face-on and edge-on, and there are always the same number", () => {
  const first = chainAt(0), last = chainAt(1);
  assert.equal(first.links.length, last.links.length);
  assert.deepEqual(last.links.slice(0, 4).map((link) => link.edge), [false, true, false, true]);
});

test("the counter's slats slide in two waves: every other slat first, the ones between after, so halfway the panel reads 1, 4, 1, 4", () => {
  assert.deepEqual(slatOffsets(0, 12), Array(12).fill(0), "every slat shows the 4");
  assert.deepEqual(slatOffsets(1, 12), Array(12).fill(1), "every slat shows the 1");
  const halfway = slatOffsets(0.5, 12);
  assert.deepEqual(halfway.map((offset) => Math.round(offset)), [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], "alternate slats are over, the rest not yet started");
  for (const progress of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const now = slatOffsets(progress, 12), later = slatOffsets(progress + 0.05, 12);
    for (let i = 0; i < 12; i += 1) assert.ok(later[i] >= now[i] - 1e-12, "slats only ever slide up, following the finger");
  }
  assert.equal(slatOffsets(2, 12)[3], 1);
  assert.equal(slatOffsets(-1, 12)[3], 0);
});

test("the down counter stands off to the right of the ball, whole inside the header, far enough away to be small", () => {
  for (const width of [320, 390, 430]) for (const height of [56, 80, 96]) {
    const lay = layout(width), counter = counterSpot(lay, height), ball = ballSpot(lay, height);
    assert.ok(counter.x > ball.nose + 10, "clear of the ball, off to its right");
    assert.ok(counter.x + 38 * counter.scale < width, "inside the page");
    assert.ok(counter.ground - 126 * counter.scale >= 0, `the whole counter is inside the header (${width}x${height})`);
    assert.ok(counter.scale <= 0.5, "small, for standing in the distance");
  }
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
