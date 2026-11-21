import assert from "node:assert/strict";
import test from "node:test";
import { LAB_VIEWER, LAB_WILDCARD_OUT, labLeaderboard, labStandard } from "../src/lib/lab-clubhouse.js";
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

test("the room's Big Board keeps the leader on top and splits the rest into even pages", async () => {
  const { labLeaderboard } = await import("../src/lib/lab-clubhouse.js");
  const { boardPages: labBoardPages } = await import("../src/lib/board-pages.js");
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const one = labBoardPages(rows);
  assert.deepEqual(one.leaders.map((row) => row.name), [rows[0].name]);
  assert.deepEqual(one.pages.map((page) => page.length), [3, 3, 3]);
  assert.ok(one.pages.flat().every((row) => row.name !== rows[0].name));
  // Level leaders: the top line says how many, and they stay in the pages so their names are shown.
  const level = rows.map((row, index) => ({ ...row, place: index < 3 ? 1 : row.place }));
  const many = labBoardPages(level);
  assert.equal(many.leaders.length, 3);
  assert.deepEqual(many.pages.map((page) => page.length), [4, 3, 3]);
  assert.deepEqual(labBoardPages(rows.slice(0, 1)).pages, [[]]);
});
