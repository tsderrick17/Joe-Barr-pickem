import test from "node:test";
import assert from "node:assert/strict";
import { COUNTER_TALL, PUFF_AT, STRETCH_END, chainTwang, ballSpot, chainAnchor, chainLinks, chainReach, counterSpot, descentPose, fieldMarks, FOOT, groundOf, layout, plantedPose, poleLength, pullStages, slatOffsets, TURF } from "../src/lib/pull-chain.js";

const HEIGHT = 60, GROUND = groundOf(HEIGHT);
const PHONE = layout(390);
const chainAt = (descent, lay = PHONE) => {
  const pose = descentPose(descent, lay, GROUND);
  return { pose, ...chainLinks(chainAnchor(lay, GROUND), pose.ring, { chainLength: chainReach(lay), groundY: GROUND, linkZoom: lay.linkZoom }) };
};

test("the scene shows three yards across the page, with the chain ten yards long: fastened ten yards behind the lead pole, far off the page to the left", () => {
  for (const width of [320, 390, 430, 768]) {
    const lay = layout(width);
    assert.ok(Math.abs(lay.yard * 3 - width) < 1e-9, "three yards across");
    assert.ok(lay.leadTo > width * 0.6 && lay.leadTo < width * 0.85, "the lead pole lands toward the right");
    assert.ok(Math.abs(lay.leadTo - lay.anchorX - 10 * lay.yard) < 1e-9, "its fixed end is ten yards behind the lead pole");
    assert.ok(lay.anchorX < -5 * lay.yard, "so it is well off the page");
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

test("the chain starts slack on the ground, is drawn out until it is stretched to its full length, and from then on stays taut, falling flat as the foot lands", () => {
  const anchor = chainAnchor(PHONE, GROUND), reach = chainReach(PHONE);
  const lengthAt = (descent) => { const { pose } = chainAt(descent); return Math.hypot(pose.ring.x - anchor.x, pose.ring.y - anchor.y); };
  const slackAt = (descent) => chainAt(descent).slack;
  assert.ok(slackAt(0) > 0.4 * PHONE.leadTo, `it begins with slack, not taut (${slackAt(0).toFixed(0)} px of slack)`);
  assert.equal(chainAt(0).taut, false);
  let previous = Infinity;
  for (const descent of [0, 0.1, 0.2, 0.3, 0.4, STRETCH_END]) {
    assert.ok(slackAt(descent) <= previous + 1e-6, "drawing it out only ever uses up slack");
    previous = slackAt(descent);
  }
  assert.ok(Math.abs(lengthAt(STRETCH_END) - reach) < 1e-6 && chainAt(STRETCH_END).taut, "fully stretched exactly when the pull-out ends");
  for (const descent of [STRETCH_END, 0.6, 0.7, 0.8, 0.9, 1]) {
    const { pose, links } = chainAt(descent);
    assert.ok(Math.abs(lengthAt(descent) - reach) < 1e-6, `the chain keeps its full length at ${descent}: the ring turns about the fixed end`);
    const slope = (pose.ring.y - anchor.y) / (pose.ring.x - anchor.x);
    for (const link of links) assert.ok(Math.abs(link.y - (anchor.y + slope * (link.x - anchor.x))) < 1e-6, "straight and taut once stretched");
  }
  const degrees = (descent) => { const ring = chainAt(descent).pose.ring; return (Math.atan2(anchor.y - ring.y, ring.x - anchor.x) * 180) / Math.PI; };
  assert.ok(Math.abs(degrees(STRETCH_END) - 2) < 0.01, `rising only 2 degrees where the drop begins, a gentle climb over ten yards (${degrees(STRETCH_END).toFixed(2)})`);
  const end = chainAt(1).pose.ring;
  assert.ok(Math.abs(end.y - anchor.y) < 1e-9 && Math.abs(end.x - PHONE.leadTo) < 1e-9, "flat, and the ring arrives at the ball only as the foot lands");
});

test("the chain gives one slight boing the moment it is stretched, which dies away", () => {
  assert.equal(chainTwang(0), 0, "no bow before it comes taut");
  let biggest = 0, lastBig = 0;
  for (let since = 1; since <= 1500; since += 1) { const bow = Math.abs(chainTwang(since)); biggest = Math.max(biggest, bow); if (bow > 0.3) lastBig = since; }
  assert.ok(biggest > 1 && biggest < 3, `slight (${biggest.toFixed(2)} px at most)`);
  assert.ok(lastBig < 600, `and gone within a moment (${lastBig} ms)`);
  assert.ok(Math.abs(chainTwang(3000)) < 0.01);
});

test("the pole comes in foot first from above the header, keeps its lean while the chain is drawn out, then straightens as it drops and lands exactly at the ball, upright", () => {
  const start = descentPose(0, PHONE, GROUND), pulled = descentPose(STRETCH_END, PHONE, GROUND), middle = descentPose(0.75, PHONE, GROUND), end = descentPose(1, PHONE, GROUND);
  assert.ok(start.lean > 15 && start.foot.x > start.top.x, "leaning, the foot ahead of the top");
  assert.ok(start.foot.y > 0 && start.foot.y < GROUND, "and while the chain is drawn out the foot is inside the header, where it can be seen");
  for (const descent of [0, 0.1, 0.25, 0.4, STRETCH_END]) {
    const pose = descentPose(descent, PHONE, GROUND);
    assert.equal(pose.lean, start.lean, "the original lean is held until the chain is fully stretched");
    assert.ok(Math.abs(pose.foot.y - start.foot.y) < 1e-9, "the pole is drawn outward at one height");
  }
  assert.ok(pulled.foot.x > start.foot.x + 40, "pulled out a good way to stretch the chain");
  assert.ok(pulled.lean > middle.lean && middle.lean > end.lean, "straightening as it drops");
  for (const [a, b] of [[STRETCH_END, 0.625], [0.625, 0.75], [0.75, 0.875], [0.875, 1]]) assert.ok(descentPose(b, PHONE, GROUND).foot.y > descentPose(a, PHONE, GROUND).foot.y, "once the drop begins the foot only ever goes down");
  assert.ok(Math.abs(end.lean) < 1e-9, "upright when it lands");
  assert.ok(Math.abs(end.foot.x - PHONE.leadTo) < 1e-9 && Math.abs(end.foot.y - GROUND) < 1e-9, "its foot is on the ground at the ball");
});

test("the landing: the foot is planted exactly where it came down and stays there, with no bounce, no squash and no swing", () => {
  const landed = plantedPose(PHONE, GROUND), arrival = descentPose(1, PHONE, GROUND);
  assert.deepEqual(landed.foot, { x: PHONE.leadTo, y: GROUND });
  assert.equal(landed.lean, 0);
  assert.ok(Math.abs(landed.foot.x - arrival.foot.x) < 1e-9 && Math.abs(landed.foot.y - arrival.foot.y) < 1e-9, "the same place the drop arrived at");
  assert.ok(Math.abs(landed.top.x - arrival.top.x) < 1e-9 && Math.abs(landed.top.y - arrival.top.y) < 1e-9, "and the same upright pole: nothing jumps at the landing");
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

test("the down counter stands off to the right of the ball, its pole planted beside the field rather than on it, whole inside the header, small, on a long pole", () => {
  for (const width of [320, 390, 430]) for (const height of [56, 80, 96]) {
    const lay = layout(width), counter = counterSpot(lay, height), ball = ballSpot(lay, height);
    assert.ok(counter.x > ball.nose + 10, "clear of the ball, off to its right");
    assert.ok(counter.x + 38 * counter.scale < width, "inside the page");
    assert.ok(counter.ground - COUNTER_TALL * counter.scale >= 0, `the whole counter is inside the header (${width}x${height})`);
    assert.equal(counter.ground, height - TURF, "its pole is planted on the sideline, off the field");
    assert.ok(counter.scale <= 0.5, "small, for standing in the distance");
    assert.ok((COUNTER_TALL - 104) / COUNTER_TALL >= 0.19, "the pole is about a fifth of its height or more");
  }
});

test("the football is spotted at the lead pole and its tip pokes out a couple of inches past the pole's foot: a first down", () => {
  for (const width of [320, 390, 430]) {
    const lay = layout(width), ball = ballSpot(lay, HEIGHT);
    const footFarEdge = lay.leadTo + 1.5 * lay.zoom;   // the flange at the foot is 3 units wide
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

test("the pole comes in at a spot on the page, and the flag hangs on the chain where it can be seen, however far the chain runs back", () => {
  for (const width of [320, 390, 430, 768]) {
    const lay = layout(width), start = descentPose(0, lay, GROUND);
    assert.ok(start.ring.x > 0.3 * lay.leadTo && start.ring.x < 0.7 * lay.leadTo, `the pole first shows on the page (${start.ring.x.toFixed(0)} of ${width})`);
    for (const descent of [0, 0.25, STRETCH_END, 0.75, 1]) {
      const { clip } = chainAt(descent, lay);
      assert.ok(clip.x > 0 && clip.x < lay.leadTo, `the flag is on the page at ${descent} (${clip.x.toFixed(0)})`);
    }
  }
});
