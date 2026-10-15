import test from "node:test";
import assert from "node:assert/strict";
import { calculatePlayoffEligibility } from "../src/lib/playoff-math.js";

/**
 * A rehearsal of the whole playoff run on the pure eligibility rule (the database function must agree with it; see the
 * playoff rules in docs/PROJECT_REFERENCE.md). The rules under test: eligibility is frozen at the start of each Eastern
 * game day; a player stays eligible all day if they could still tie the day-start leader; once they cannot, they are out.
 * Nothing here touches a database.
 */
const players = ["ann", "bob", "cy", "dee"].map((id) => ({ id }));
const periods = (activeId) => [
  { id: "wild", display_order: 19, period_type: "playoff", status: activeId === "wild" ? "active" : "complete", max_picks: 6 },
  { id: "div", display_order: 20, period_type: "playoff", status: activeId === "div" ? "active" : activeId === "wild" ? "upcoming" : "complete", max_picks: 4 },
  { id: "conf", display_order: 21, period_type: "playoff", status: activeId === "conf" ? "active" : ["wild", "div"].includes(activeId) ? "upcoming" : "complete", max_picks: 2 },
  { id: "sb", display_order: 22, period_type: "playoff", status: activeId === "sb" ? "active" : "upcoming", max_picks: 1 },
];
const game = (id, scoring_period_id, kickoff_at, status = "final") => ({ id, scoring_period_id, kickoff_at, status });
const win = (player_id, game_id) => ({ player_id, game_id, result: "win" });
const loss = (player_id, game_id) => ({ player_id, game_id, result: "loss" });
const run = (activeId, now, games, picks) => calculatePlayoffEligibility({ players, periods: periods(activeId), games, picks, targetPeriodId: activeId, now: new Date(now) });
const out = (result) => [...result.eliminatedPlayerIds].sort();

test("nobody is out on the first game day: nothing has been settled yet", () => {
  const games = [game("w1", "wild", "2027-01-09T21:30:00Z", "scheduled"), game("w2", "wild", "2027-01-10T01:15:00Z", "scheduled")];
  const result = run("wild", "2027-01-09T16:00:00Z", games, []);
  assert.equal(result.leaderWinsAtDayStart, 0);
  assert.deepEqual(out(result), []);
});

test("the day-start snapshot ignores results that arrive later the same Eastern day", () => {
  // Sunday Jan 10 ET. Saturday's game (w1) is settled; Sunday's early game (w3) kicks off at 1 PM ET and settles by evening.
  const games = [game("w1", "wild", "2027-01-09T21:30:00Z"), game("w3", "wild", "2027-01-10T18:00:00Z"), game("w4", "wild", "2027-01-10T23:30:00Z", "scheduled")];
  const saturday = [win("ann", "w1"), loss("bob", "w1")];
  const morning = run("wild", "2027-01-10T14:00:00Z", games, saturday);
  const evening = run("wild", "2027-01-11T00:30:00Z", games, [...saturday, win("ann", "w3")]);
  assert.equal(morning.leaderWinsAtDayStart, 1);
  assert.equal(evening.leaderWinsAtDayStart, 1, "Sunday's own results never move Sunday's snapshot");
  assert.deepEqual(out(morning), out(evening));
});

test("a player who can only tie the leader stays eligible; one win short of that is out", () => {
  // Round 1 has nine settled games on Saturday and one left on Sunday. The leader won all nine.
  const settled = Array.from({ length: 9 }, (_, index) => game(`s${index}`, "wild", "2027-01-09T18:00:00Z"));
  const games = [...settled, game("f", "wild", "2027-01-10T18:00:00Z", "scheduled")];
  // Still to be had on Sunday: game f (1) + div max 4 + conf 2 + sb 1 = 8 wins.
  const picks = [...settled.map((g) => win("ann", g.id)), win("bob", "s0")];
  const result = run("wild", "2027-01-10T15:00:00Z", games, picks);
  assert.equal(result.leaderWinsAtDayStart, 9);
  assert.equal(result.remainingPossibleWins, 8);
  assert.deepEqual(out(result), ["cy", "dee"], "0 wins + 8 possible = 8 < 9 is out; bob has 1 + 8 = 9, can still tie, and stays in");
});

test("the Eastern midnight, not UTC midnight, starts a new game day", () => {
  const games = [game("late", "wild", "2027-01-10T01:15:00Z"), game("sun", "wild", "2027-01-10T18:00:00Z", "scheduled")];
  const picks = [win("ann", "late")];
  // 04:59 UTC on Jan 10 is 11:59 PM ET on Jan 9: the Saturday-night game still belongs to Saturday, so it is not counted yet.
  assert.equal(run("wild", "2027-01-10T04:59:00Z", games, picks).leaderWinsAtDayStart, 0);
  // 05:00 UTC is midnight ET: Sunday has begun, and Saturday's finals count.
  assert.equal(run("wild", "2027-01-10T05:00:00Z", games, picks).leaderWinsAtDayStart, 1);
});

test("cancelled and postponed games never count as wins still to be had", () => {
  const games = [
    game("a", "wild", "2027-01-09T18:00:00Z"),
    game("p", "wild", "2027-01-10T18:00:00Z", "postponed"),
    game("c", "wild", "2027-01-10T21:00:00Z", "cancelled"),
    game("s", "wild", "2027-01-10T23:00:00Z", "scheduled"),
  ];
  const result = run("wild", "2027-01-10T15:00:00Z", games, [win("ann", "a")]);
  assert.equal(result.remainingPossibleWins, 1 + 4 + 2 + 1, "game s, then the Divisional (4), Conference (2) and Super Bowl (1) picks");
});

test("the rule only applies to an active playoff round", () => {
  const regular = calculatePlayoffEligibility({ players, periods: [{ id: "w18", display_order: 18, period_type: "regular", status: "active", max_picks: 2 }], games: [], picks: [], targetPeriodId: "w18" });
  assert.equal(regular.applies, false);
  assert.deepEqual([...regular.eliminatedPlayerIds], []);
  assert.equal(run("div", "2027-01-16T16:00:00Z", [], []).applies, true);
  const notYet = calculatePlayoffEligibility({ players, periods: periods("wild"), games: [], picks: [], targetPeriodId: "div" });
  assert.equal(notYet.applies, false, "an upcoming round has no eligibility yet");
});

test("through the whole run, the leader is never out and the out list only ever grows", () => {
  // Four rounds; ann always wins, dee always loses, bob and cy trade results. Walk each round's Eastern days in order.
  const rounds = { wild: ["2027-01-09T18:00:00Z", 6], div: ["2027-01-16T18:00:00Z", 4], conf: ["2027-01-24T18:00:00Z", 2], sb: ["2027-02-07T23:30:00Z", 1] };
  const games = [];
  const picks = [];
  for (const [round, [start, count]] of Object.entries(rounds)) {
    for (let index = 0; index < count; index += 1) {
      const id = `${round}-${index}`;
      games.push(game(id, round, new Date(Date.parse(start) + index * 8 * 3_600_000).toISOString()));
      picks.push(win("ann", id), loss("dee", id), index % 2 ? win("bob", id) : loss("bob", id), index % 2 ? loss("cy", id) : win("cy", id));
    }
  }
  const days = [
    ["wild", "2027-01-09T16:00:00Z"], ["wild", "2027-01-10T16:00:00Z"], ["wild", "2027-01-11T16:00:00Z"],
    ["div", "2027-01-16T16:00:00Z"], ["div", "2027-01-17T16:00:00Z"], ["conf", "2027-01-24T16:00:00Z"], ["sb", "2027-02-07T16:00:00Z"],
  ];
  let previous = new Set();
  for (const [round, now] of days) {
    const result = run(round, now, games, picks);
    assert.equal(result.eliminatedPlayerIds.has("ann"), false, `the leader is never out (${round} ${now})`);
    for (const id of previous) assert.equal(result.eliminatedPlayerIds.has(id), true, `${id} cannot come back in (${round} ${now})`);
    previous = result.eliminatedPlayerIds;
  }
  assert.equal(previous.has("dee"), true, "the player who loses every pick is out by the last day");
});
