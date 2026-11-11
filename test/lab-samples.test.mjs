import assert from "node:assert/strict";
import test from "node:test";
import { LAB_DIVISIONS, LAB_PLAYERS, LAB_SLATE, LAB_SURVIVOR, LAB_TEAM_NAMES, labAtsResult, labLineFor, labSurvivorAt } from "../src/lib/lab-samples.js";
import { LAB_SHELF, labChoice } from "../src/lib/lab-shelf.js";

const TEAMS = LAB_DIVISIONS.flatMap((division) => division.teams);

test("the sample league has all 32 teams once, each with a name", () => {
  assert.equal(TEAMS.length, 32);
  assert.equal(new Set(TEAMS).size, 32);
  for (const team of TEAMS) assert.ok(LAB_TEAM_NAMES[team], team);
});

test("every sample Survivor run uses real teams, never one twice, and ends at its first loss", () => {
  assert.deepEqual(Object.keys(LAB_SURVIVOR).sort(), [...LAB_PLAYERS].sort());
  for (const [name, run] of Object.entries(LAB_SURVIVOR)) {
    const teams = run.map(([team]) => team);
    assert.equal(new Set(teams).size, teams.length, `${name} reuses a team`);
    for (const team of teams) assert.ok(TEAMS.includes(team), `${name}: ${team}`);
    const loss = run.findIndex(([, result]) => result === "L");
    if (loss >= 0) assert.equal(loss, run.length - 1, `${name} keeps playing after a loss`);
  }
});

test("the table as of a week: who is out, from which week, and the team on the felt", () => {
  const week3 = labSurvivorAt(3);
  const hank = week3.find((seat) => seat.name === "Hank");
  assert.equal(hank.out, true);
  assert.equal(hank.outWeek, 3);
  assert.deepEqual(hank.current, { team: "CIN", result: "L" });   // lost this very week: still shown on the felt
  const gus = week3.find((seat) => seat.name === "Gus");
  assert.equal(gus.current, null);   // out since week 2
  assert.equal(gus.weeks.length, 2);
  const week9 = labSurvivorAt(9);
  assert.deepEqual(week9.filter((seat) => !seat.out).map((seat) => seat.name), ["Walt", "Rosie", "Dottie", "Earl", "June"]);
});

test("sample lines and against-the-spread results read like the pool's: a push is a loss", () => {
  const [pit, , phi, sf] = LAB_SLATE;
  assert.equal(labLineFor(pit, "PIT"), "-2.5");
  assert.equal(labLineFor(pit, "CLE"), "+2.5");
  assert.equal(labAtsResult(pit, "PIT"), "W");
  assert.equal(labAtsResult(phi, "LAR"), "W");
  assert.equal(labAtsResult(phi, "PHI"), "L");
  assert.equal(labAtsResult(sf, "SF"), "L");   // 20-20 at -3
  assert.equal(labAtsResult(sf, "DEN"), "W");
});

test("the Lab opens the try-out in the address, else the last one, else the newest; unknown ones are ignored", () => {
  assert.equal(labChoice("feel", "ticket"), "feel");
  assert.equal(labChoice("nope", "feel"), "feel");
  assert.equal(labChoice(null, null), LAB_SHELF[0].id);
  assert.equal(labChoice(undefined, "nope"), LAB_SHELF[0].id);
});
