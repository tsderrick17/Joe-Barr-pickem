import assert from "node:assert/strict";
import test from "node:test";
import { LAB_VIEWER, LAB_WILDCARD_OUT, labLeaderboard, labStandard, labSurvivorBoard } from "../src/lib/lab-clubhouse.js";
import { LAB_PLAYERS } from "../src/lib/lab-samples.js";

test("before kickoff another player's picks and Survivor chip are hidden; the viewer always sees their own", () => {
  for (const name of LAB_PLAYERS) {
    const standard = labStandard(name, { round: "regular", moment: "before" });
    assert.equal(standard.slats.length, 2);
    if (name === LAB_VIEWER) {
      assert.ok(standard.slats.every((slat) => !slat.hidden && slat.team && slat.result === null));
      assert.equal(standard.survivor?.hidden, false);
    } else {
      assert.ok(standard.slats.every((slat) => slat.hidden && slat.team === null && slat.line === null));
      if (standard.survivor) assert.equal(standard.survivor.team, null);
    }
  }
});

test("on game day only the games that have kicked off show, and they are graded; the rest stay hidden", () => {
  // Rosie took CLE (first game, kicked off) and PHI (third game, not yet).
  const rosie = labStandard("Rosie", { round: "regular", moment: "gameday" });
  assert.deepEqual(rosie.slats.map((slat) => [slat.team, slat.hidden, slat.result]), [["CLE", false, "L"], [null, true, null]]);
  const graded = labStandard("Rosie", { round: "regular", moment: "graded" });
  assert.ok(graded.slats.every((slat) => !slat.hidden && (slat.result === "W" || slat.result === "L")));
});

test("a Wild Card standard has six slats and no Survivor chip (Survivor runs through the regular season)", () => {
  const walt = labStandard("Walt", { round: "wildcard", moment: "graded" });
  assert.equal(walt.slats.length, 6);
  assert.equal(walt.survivor, null);
});

test("the leaderboard shares a place between level players, counts back from the leader, and turns out players' plates", () => {
  const regular = labLeaderboard({ round: "regular", moment: "before" });
  assert.equal(regular.length, LAB_PLAYERS.length);
  assert.equal(regular[0].back, 0);
  const walt = regular.find((row) => row.name === "Walt");
  const dottie = regular.find((row) => row.name === "Dottie");
  assert.equal(walt.place, dottie.place);
  assert.ok(walt.tied && dottie.tied);
  const wildcard = labLeaderboard({ round: "wildcard", moment: "graded" });
  const out = wildcard.filter((row) => row.out).map((row) => row.name).sort();
  assert.deepEqual(out, [...LAB_WILDCARD_OUT].sort());
  assert.ok(wildcard.slice(-out.length).every((row) => row.out && row.place === null && row.back === null));
});

test("the Survivor board marks used teams and kicked-off games, and is read only for a player who is out", () => {
  const walt = labSurvivorBoard({ moment: "before" });
  assert.equal(walt.out, false);
  assert.equal(walt.teams.find((team) => team.team === "PHI").usedWeek, 4);
  assert.equal(walt.teams.find((team) => team.team === "DEN").free, true);
  const gameday = labSurvivorBoard({ moment: "gameday" });
  assert.equal(gameday.teams.find((team) => team.team === "PIT").locked, true);
  assert.equal(gameday.teams.find((team) => team.team === "PIT").free, false);
  const hank = labSurvivorBoard({ moment: "before", viewer: "Hank" });
  assert.equal(hank.out, true);
  assert.equal(hank.outWeek, 3);
  assert.ok(hank.teams.every((team) => !team.free));
});
