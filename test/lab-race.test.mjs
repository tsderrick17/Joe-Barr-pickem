import assert from "node:assert/strict";
import test from "node:test";
import { LAB_RACE_DAYS, LAB_RACE_FRAMES, LAB_RACE_LANES, LAB_RACE_WEEKS, labRaceAt, labRaceHeadline, labRaceStepMs } from "../src/lib/lab-race.js";
import { LAB_PLAYERS, LAB_STANDINGS } from "../src/lib/lab-samples.js";

test("the race agrees with the sample standings: week 9 as the Pick'em standings read, week 18 as the Wild Card round starts", () => {
  const wins = (frame) => Object.fromEntries(labRaceAt(frame).horses.map((horse) => [horse.name, horse.wins]));
  for (const row of LAB_STANDINGS) assert.equal(wins(9)[row.name], row.wins, row.name);
  assert.deepEqual(wins(LAB_RACE_WEEKS), { Earl: 21, Walt: 20, Dottie: 20, Rosie: 19, June: 18, Lou: 17, Marge: 17, Hank: 16, Bev: 13, Gus: 12 });
  assert.deepEqual([...LAB_RACE_LANES].sort(), [...LAB_PLAYERS].sort());
});

test("nobody wins more than their picks: two a week, and no more than the games of a playoff day", () => {
  for (const frame of LAB_RACE_FRAMES.slice(1)) {
    const before = LAB_RACE_FRAMES[frame.index - 2];
    const picks = frame.kind === "week" ? 2 : LAB_RACE_DAYS[frame.index - LAB_RACE_WEEKS - 1].games;
    for (const name of LAB_RACE_LANES) assert.ok(frame.wins[name] - before.wins[name] <= picks, `${name} at ${frame.label}`);
  }
  assert.equal(LAB_RACE_DAYS.reduce((sum, day) => sum + day.games, 0), 13);
});

test("the pool is decided only at the last frame: nobody else can tie the leader by then, and someone could until then", () => {
  const last = LAB_RACE_FRAMES[LAB_RACE_FRAMES.length - 1];
  assert.equal(last.decided, true);
  assert.equal(LAB_RACE_FRAMES.filter((frame) => frame.decided).length, 1);
  assert.equal(last.leaders.length, 1);
  const top = last.wins[last.leaders[0]];
  assert.ok(LAB_RACE_LANES.filter((name) => name !== last.leaders[0]).every((name) => top - last.wins[name] > last.left));
  assert.equal(last.label, "Conference Sunday");
});

test("a horse pulls up once it cannot tie the leader even by winning every pick left, and stays put", () => {
  for (const frame of LAB_RACE_FRAMES) {
    const top = Math.max(...Object.values(frame.wins));
    for (const name of LAB_RACE_LANES) assert.equal(frame.pulledUp.includes(name), top - frame.wins[name] > frame.left, `${name} at ${frame.label}`);
  }
  let stoppedAt = null;
  for (let at = 1; at <= LAB_RACE_FRAMES.length; at++) {
    const gus = labRaceAt(at).horses.find((horse) => horse.name === "Gus");
    if (gus.pulledUp && stoppedAt === null) stoppedAt = gus.x;
    if (stoppedAt !== null) assert.equal(gus.x, stoppedAt);
  }
  assert.notEqual(stoppedAt, null);
});

test("on the track: nobody runs backwards, wins order the field, the leader reaches the pole only when the pool is decided", () => {
  let before = null;
  for (let at = 1; at <= LAB_RACE_FRAMES.length; at++) {
    const { frame, horses } = labRaceAt(at);
    for (const horse of horses) {
      assert.ok(horse.x >= 0.05 && horse.x <= 1, `${horse.name} stays on the track at ${frame.label}`);
      if (before) assert.ok(horse.x >= before.find((other) => other.name === horse.name).x - 1e-9, `${horse.name} never runs backwards at ${frame.label}`);
      if (horse.x >= 1) assert.ok(frame.decided && horse.finished);
    }
    const leader = horses.find((horse) => horse.name === frame.leaders[0]);
    for (const horse of horses) if (!horse.pulledUp && horse.wins < leader.wins) assert.ok(horse.x < leader.x, `${horse.name} behind the leader at ${frame.label}`);
    before = horses;
  }
  assert.equal(labRaceAt(LAB_RACE_FRAMES.length).horses.filter((horse) => horse.finished).length, 1);
});

test("early gaps are stretched and the final stretch is long: a one-win gap is longer in week 1 than in week 18, the replay slows for the playoffs", () => {
  const gapOf = (frame) => { const { horses } = labRaceAt(frame); const wins = (name) => horses.find((horse) => horse.name === name).wins, x = (name) => horses.find((horse) => horse.name === name).x; return { wins: wins("Earl") - wins("Walt"), x: x("Earl") - x("Walt") }; };
  const week3 = gapOf(3);
  const week18 = gapOf(LAB_RACE_WEEKS);
  assert.ok(week3.x / week3.wins > week18.x / week18.wins);
  assert.ok(labRaceStepMs(LAB_RACE_FRAMES[0]) < labRaceStepMs(LAB_RACE_FRAMES[LAB_RACE_WEEKS]));
  assert.ok(labRaceStepMs(LAB_RACE_FRAMES[LAB_RACE_FRAMES.length - 1]) > labRaceStepMs(LAB_RACE_FRAMES[LAB_RACE_WEEKS]));
});

test("the headline says who leads and where the viewer stands, or who won", () => {
  assert.equal(labRaceHeadline(9), "Earl leads by 1 · You: T2");
  assert.equal(labRaceHeadline(LAB_RACE_FRAMES.length), "Earl wins the pool after Conference Sunday");
});
