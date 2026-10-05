import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { decidePickChoice, decideRemoval, decideSurvivorChoice, describeSelectedTeams, filterPoolActionDays, groupGamesByDay, picksDiffer, withPick, withoutGame, SEALED_MESSAGE } = await import("../src/lib/slate-view.ts");

// 1:30 PM Eastern on a Sunday: g1 (1:00 PM) has kicked off; g2 (4:25 PM), g3 (Monday) and g4 have not.
const NOW = Date.parse("2026-10-04T17:30:00Z");
const game = (id, away, home, kickoffAt, extra = {}) => ({ id, awayTeam: `${away} Away`, homeTeam: `${home} Home`, awayTeamAbbreviation: away, homeTeamAbbreviation: home, awayTeamId: away.toLowerCase(), homeTeamId: home.toLowerCase(), favoriteTeamId: home.toLowerCase(), officialSpread: null, preliminarySpread: null, spreadLockedAt: null, kickoffAt, awayPickers: [], homePickers: [], ...extra });
const games = [
  game("g1", "AAA", "BBB", "2026-10-04T17:00:00Z"),
  game("g2", "CCC", "DDD", "2026-10-04T20:25:00Z", { preliminarySpread: 3.5 }),
  game("g3", "EEE", "FFF", "2026-10-06T00:15:00Z", { officialSpread: 3, spreadLockedAt: "2026-10-05T12:00:00Z", favoriteTeamId: "eee" }),
  game("g4", "GGG", "HHH", "2026-10-06T00:15:00Z", { officialSpread: 0, spreadLockedAt: "2026-10-05T12:00:00Z" }),
];

test("choosing a team: add, swap, remove, limit, and sealed after kickoff", () => {
  const choose = (picks, gameId, teamId, limit = 2) => decidePickChoice({ picks, games, gameId, teamId, now: NOW, limit }).kind;
  assert.equal(choose([], "g2", "ddd"), "add");
  assert.equal(choose([{ gameId: "g2", teamId: "ddd" }], "g2", "ccc"), "swap");
  assert.equal(choose([{ gameId: "g2", teamId: "ddd" }], "g2", "ddd"), "remove");
  assert.equal(choose([{ gameId: "g2", teamId: "ddd" }, { gameId: "g3", teamId: "fff" }], "g4", "hhh"), "limit");
  // A swap or removal stays allowed at the limit; only a new game is refused.
  assert.equal(choose([{ gameId: "g2", teamId: "ddd" }, { gameId: "g3", teamId: "fff" }], "g2", "ccc"), "swap");
  // A started game is sealed, whatever else is true; so is a game that does not exist.
  assert.deepEqual(decidePickChoice({ picks: [], games, gameId: "g1", teamId: "bbb", now: NOW, limit: 2 }), { kind: "sealed", warning: SEALED_MESSAGE });
  assert.equal(choose([], "nope", "x"), "sealed");
  // At the kickoff instant the game seals; a second earlier it does not.
  assert.equal(decidePickChoice({ picks: [], games, gameId: "g2", teamId: "ddd", now: Date.parse("2026-10-04T20:24:59Z"), limit: 2 }).kind, "add");
  assert.equal(decidePickChoice({ picks: [], games, gameId: "g2", teamId: "ddd", now: Date.parse("2026-10-04T20:25:00Z"), limit: 2 }).kind, "sealed");
  assert.match(decidePickChoice({ picks: [{ gameId: "g2", teamId: "ddd" }, { gameId: "g3", teamId: "fff" }], games, gameId: "g4", teamId: "hhh", now: NOW, limit: 2 }).warning, /You already have 2 selections/);
});

test("pick list updates keep one pick per game", () => {
  assert.deepEqual(withPick([{ gameId: "g2", teamId: "ddd" }], "g2", "ccc"), [{ gameId: "g2", teamId: "ccc" }]);
  assert.deepEqual(withPick([{ gameId: "g2", teamId: "ddd" }], "g3", "fff"), [{ gameId: "g2", teamId: "ddd" }, { gameId: "g3", teamId: "fff" }]);
  assert.deepEqual(withoutGame([{ gameId: "g2", teamId: "ddd" }, { gameId: "g3", teamId: "fff" }], "g2"), [{ gameId: "g3", teamId: "fff" }]);
});

test("Survivor: a used team is refused, except the one chosen or saved this week", () => {
  const base = { games, gameId: "g2", teamId: "ccc", now: NOW, current: null, saved: null, usedTeamIds: ["ccc"] };
  assert.equal(decideSurvivorChoice(base).kind, "warn");
  assert.equal(decideSurvivorChoice({ ...base, usedTeamIds: [] }).kind, "select");
  // The team currently chosen, or the saved one while an unsaved replacement is pending, stays selectable.
  assert.equal(decideSurvivorChoice({ ...base, current: { gameId: "g2", teamId: "ccc" } }).kind, "select");
  assert.equal(decideSurvivorChoice({ ...base, saved: { gameId: "g2", teamId: "ccc" } }).kind, "select");
  // A started or unknown game is ignored without a message.
  assert.equal(decideSurvivorChoice({ ...base, gameId: "g1", teamId: "bbb", usedTeamIds: [] }).kind, "ignore");
  assert.equal(decideSurvivorChoice({ ...base, gameId: "nope", usedTeamIds: [] }).kind, "ignore");
});

test("removing a pick from the receipt is refused once its game has started", () => {
  assert.deepEqual(decideRemoval({ games, gameId: "g2", now: NOW }), { allowed: true });
  assert.deepEqual(decideRemoval({ games, gameId: "g1", now: NOW }), { allowed: false, warning: SEALED_MESSAGE });
  assert.equal(decideRemoval({ games, gameId: "nope", now: NOW }).allowed, false);
});

test("games group by Eastern day, and Pool Action keeps upcoming games and started ones with public picks", () => {
  const days = groupGamesByDay(games);
  assert.deepEqual(days.map(([day, list]) => [day, list.map((item) => item.id)]), [["Sunday, October 4", ["g1", "g2"]], ["Monday, October 5", ["g3", "g4"]]]);
  // Upcoming games always stay; a started game stays only if someone's pick on it is public.
  const ids = (view) => view.map(([day, list]) => [day, list.map((item) => item.id)]);
  assert.deepEqual(ids(filterPoolActionDays(days, NOW)), [["Sunday, October 4", ["g2"]], ["Monday, October 5", ["g3", "g4"]]]);
  const withPickers = games.map((item) => (item.id === "g1" ? { ...item, homePickers: ["Dana"] } : item));
  assert.deepEqual(ids(filterPoolActionDays(groupGamesByDay(withPickers), NOW)), [["Sunday, October 4", ["g1", "g2"]], ["Monday, October 5", ["g3", "g4"]]]);
  // Once everything has started with no picks, the days vanish.
  assert.deepEqual(filterPoolActionDays(days, Date.parse("2026-10-07T00:00:00Z")), []);
});

test("the receipt lists selections in game order with signed lines, locks and removability", () => {
  const picks = [{ gameId: "g4", teamId: "hhh" }, { gameId: "g3", teamId: "eee" }, { gameId: "g2", teamId: "ccc" }, { gameId: "g1", teamId: "bbb" }];
  const saved = [{ gameId: "g3", teamId: "eee" }];
  const lines = describeSelectedTeams({ picks, savedPicks: saved, games, now: NOW });
  assert.deepEqual(lines.map((line) => line.gameId), ["g1", "g2", "g3", "g4"]);
  const [g1, g2, g3, g4] = lines;
  // Home teams read in capitals with an uppercase abbreviation; away teams keep their name with a lowercase one.
  assert.deepEqual([g1.name, g1.abbreviation], ["BBB HOME", "BBB"]);
  assert.deepEqual([g2.name, g2.abbreviation], ["CCC Away", "ccc"]);
  // Preliminary line for g2 (the favorite is the home team, so the away pick is the underdog), official for g3 and g4.
  assert.deepEqual([g2.lineValue, g2.isLineLocked], ["+3.5", false]);
  assert.deepEqual([g3.lineValue, g3.isLineLocked, g3.isSaved], ["-3", true, true]);
  assert.deepEqual([g4.lineValue, g1.lineValue], ["PK", null]);
  // A started game's pick cannot be removed; the rest can.
  assert.deepEqual(lines.map((line) => line.canRemove), [false, true, true, true]);
  // A pick whose team is not in the game is dropped rather than shown wrong.
  assert.equal(describeSelectedTeams({ picks: [{ gameId: "g2", teamId: "zzz" }], savedPicks: [], games, now: NOW }).length, 0);
});

test("unsaved changes: any difference in game or team, in either direction", () => {
  const a = [{ gameId: "g2", teamId: "ddd" }];
  assert.equal(picksDiffer(a, [{ gameId: "g2", teamId: "ddd" }]), false);
  assert.equal(picksDiffer(a, [{ gameId: "g2", teamId: "ccc" }]), true);
  assert.equal(picksDiffer(a, []), true);
  assert.equal(picksDiffer([], a), true);
  assert.equal(picksDiffer([{ gameId: "g2", teamId: "ddd" }, { gameId: "g3", teamId: "fff" }], [{ gameId: "g3", teamId: "fff" }, { gameId: "g2", teamId: "ddd" }]), false);
});
