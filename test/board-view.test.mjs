import test from "node:test";
import assert from "node:assert/strict";
import { boardViewSupported, coverMargin, realBoardView } from "../src/lib/board-view.js";
import { homeResponse } from "./visual/standings-fixtures.mjs";
import { boardResponse } from "./visual/slate-fixtures.mjs";

const reads = (scenario = "upcoming-picked") => ({ home: homeResponse("regular-in"), board: boardResponse(scenario) });

test("the board is the week's standings by wins, with the viewer's own picks from the Slate and others' covered picks still covered", () => {
  const view = realBoardView(reads());
  const you = view.rows.find((row) => row.you);
  assert.equal(you.name, "Tyler");
  assert.deepEqual(you.slats.map((slat) => slat.team), ["LAR", "TEN"]);   // from the Slate's own read of the viewer's picks, in kickoff order
  const hidden = view.rows.find((row) => row.name === "Ron");
  assert.deepEqual(hidden.slats.map((slat) => [slat.hidden, slat.team]), [[true, null], [true, null]]);   // never a team for a covered pick
  assert.ok(view.rows.every((row, index) => index === 0 || view.rows[index - 1].wins >= row.wins));
});

test("a player with fewer picks than the week allows has empty slots, never a made-up pick", () => {
  const reading = reads("upcoming-no-survivor");
  const view = realBoardView(reading);
  assert.equal(view.rows.find((row) => row.you).slats[1], null);
  assert.equal(view.mine.picks.length, 1);
});

test("the ticket's teams: a kicked-off game is locked, a team used in an earlier week is not free, this week's own Survivor pick still is", () => {
  const view = realBoardView(reads("live-mixed-locks-survivor"));
  const lockedGame = view.games.find((game) => game.kickedOff);
  assert.ok(lockedGame, "a game has kicked off");
  assert.equal(view.survivor.teams[lockedGame.away].free, false);
  assert.equal(view.survivor.teams[lockedGame.away].locked, true);
  const openGame = view.games.find((game) => !game.kickedOff);
  const used = Object.entries(view.survivor.teams).filter(([, team]) => team.used).map(([abbr]) => abbr);
  for (const abbr of used) assert.equal(view.survivor.teams[abbr].free, false);
  assert.ok(openGame);
});

test("Survivor: the viewer's own pick and an eliminated viewer", () => {
  assert.deepEqual(realBoardView(reads("upcoming-picked")).rows.find((row) => row.you).survivor.kind, "pick");
  assert.equal(realBoardView(reads("upcoming-unpicked")).rows.find((row) => row.you).survivor.kind, "owed");
  const out = realBoardView(reads("upcoming-no-survivor"));   // the fixture's "hidden" scenario is an eliminated viewer
  assert.equal(out.survivor.out, true);
  assert.equal(out.rows.find((row) => row.you).survivor.kind, "out");
  assert.equal(out.survivor.playing, false);
});

test("the new board covers the regular season only: a playoff week (a pick for every game) opens the classic Slate", () => {
  assert.equal(boardViewSupported(homeResponse("regular-in"), boardResponse("upcoming-picked")), true);
  assert.equal(boardViewSupported({ ...homeResponse("regular-in"), isPlayoff: true }, boardResponse("playoff-upcoming")), false);
  assert.equal(boardViewSupported({ ...homeResponse("regular-in"), maxPicks: 6 }, boardResponse("playoff-six-picks")), false);
  assert.equal(boardViewSupported(homeResponse("regular-in"), { ...boardResponse("upcoming-picked"), games: [] }), false);
});

test("a finished week or the off-season cannot be picked in", () => {
  assert.equal(realBoardView(reads("upcoming-picked")).canPick, true);
  assert.equal(realBoardView(reads("complete-survivor")).canPick, false);
  assert.equal(realBoardView({ home: { ...homeResponse("regular-in"), seasonPhase: "off_season" }, board: boardResponse("upcoming-picked") }).canPick, false);
});

test("once every pick is in and its game has kicked off, there is nothing to change: no ticket", () => {
  const raw = boardResponse("live-mixed-locks-survivor");
  const now = Date.parse(raw.serverTime);
  const started = raw.games.filter((game) => game.status !== "scheduled" || Date.parse(game.kickoffAt) <= now);
  const waiting = raw.games.filter((game) => !started.includes(game));
  assert.ok(started.length >= 3 && waiting.length >= 1, "the fixture has games both kicked off and still to come");
  const pickOf = (game) => ({ gameId: game.id, teamId: game.awayTeamId });
  const survivorOf = (game) => ({ game_id: game.id, selected_team_id: game.homeTeamId });
  const view = (myPicks, survivorGame) => realBoardView({ home: homeResponse("regular-in"), board: { ...raw, myPicks, survivor: { ...raw.survivor, status: "active", pick: survivorOf(survivorGame), usedTeamIds: [] } } });
  assert.equal(view([pickOf(started[0]), pickOf(started[1])], started[2]).canPick, false, "two picks and the Survivor team, all kicked off");
  assert.equal(view([pickOf(started[0]), pickOf(waiting[0])], started[2]).canPick, true, "a pick still to kick off can change");
  assert.equal(view([pickOf(started[0]), pickOf(started[1])], waiting[0]).canPick, true, "the Survivor team still to kick off can change");
  assert.equal(view([pickOf(started[0])], started[2]).canPick, true, "a pick still owed");
});

test("another week's board is read from the Slate: a player's picks are the ones named under each team, their wins are that week's, and it is a look back only", () => {
  const raw = boardResponse("complete-survivor");   // week 5 is the default; every game in this read is over
  const view = realBoardView({ home: homeResponse("regular-in"), board: raw }, { weekId: "week-3" });
  assert.equal(view.week, "WEEK 3"); assert.equal(view.status, "FINAL"); assert.equal(view.weekId, "week-3");
  assert.equal(view.canPick, false, "another week is never picked in from the board");
  assert.equal(view.showSurvivor, false);
  const named = (name) => raw.games.flatMap((game) => [game.awayPickers.includes(name) ? game.awayTeamAbbreviation : null, game.homePickers.includes(name) ? game.homeTeamAbbreviation : null]).filter(Boolean);
  const dana = view.rows.find((row) => row.name === "Dana");
  assert.deepEqual(dana.slats.map((slat) => slat.team), named("Dana").slice(0, 2));
  assert.equal(view.rows.find((row) => row.name === "Rick").slats.every((slat) => slat === null), true, "a player named nowhere has no picks that week");
  const wins = view.rows.map((row) => row.wins);
  assert.deepEqual(wins, [...wins].sort((a, b) => b - a), "the board is in order of that week's wins");
  // The default week is untouched, and the weeks to choose from are the regular season's, as far as the pool has opened them.
  const current = realBoardView({ home: homeResponse("regular-in"), board: raw });
  assert.equal(current.weekId, "week-5");
  assert.deepEqual(current.weeks.map((week) => week.id), ["week-1", "week-2", "week-3", "week-4", "week-5"]);
});

test("Pool action: a game to come, or one the pool has a pick in; a finished game nobody picked is All games only", () => {
  const raw = boardResponse("live-mixed-locks-survivor");
  const bare = { ...raw, games: raw.games.map((game, index) => (index === 0 ? { ...game, awayPickers: [], homePickers: [] } : game)) };
  const view = realBoardView({ home: homeResponse("regular-in"), board: { ...bare, showPoolAction: true } });
  assert.equal(view.poolAction, true);
  assert.equal(view.games[0].kickedOff, true); assert.equal(view.games[0].action, false);
  assert.equal(view.games.filter((game) => !game.kickedOff).every((game) => game.action), true);
  assert.equal(view.games[1].action, true, "a game that has started with a pick in it is pool action");
});

test("the week the pick is sent for is the Slate's own default week", () => {
  const view = realBoardView(reads());
  assert.ok(view.weekId);
  assert.equal(view.weekId, boardResponse("upcoming-picked").bootstrap.weeks.find((week) => week.status === "active" || week.status === "upcoming").id);
});

test("a final game carries each side's score and how far it finished past its line; a game not final carries none", () => {
  const final = realBoardView(reads("complete-survivor")).games[0];
  const [a, b] = [final.results[final.away], final.results[final.home]];
  assert.equal(a.score, 17);
  assert.equal(b.score, 14);
  assert.equal(a.margin, 0.5);    // the 2.5-point favourite won by 3
  assert.equal(b.margin, -0.5);
  const live = realBoardView(reads("upcoming-picked")).games[0];
  assert.deepEqual([live.results[live.away].score, live.results[live.away].margin], [null, null]);
});

test("each side carries the players who took it, as the Slate names them once the game has kicked off", () => {
  const raw = boardResponse("complete-survivor");
  const view = realBoardView(reads("complete-survivor"));
  const first = raw.games[0];
  assert.deepEqual(view.games[0].results[first.awayTeamAbbreviation].pickers, first.awayPickers);
  assert.deepEqual(view.games[0].results[first.homeTeamAbbreviation].pickers, first.homePickers);
  assert.ok(first.awayPickers.length > 0, "the fixture names someone");
  const upcoming = realBoardView(reads("upcoming-picked"));
  assert.deepEqual(upcoming.games.flatMap((game) => Object.values(game.results).flatMap((result) => result.pickers)), [], "nobody is named before a game kicks off");
});

test("a push is a margin of zero, and a game with no line has no margin", () => {
  assert.equal(coverMargin(20, 17, "-3"), 0);
  assert.equal(coverMargin(20, 20, "PK"), 0);
  assert.equal(coverMargin(20, 17, "—"), null);
  assert.equal(coverMargin(null, 17, "-3"), null);
});

test("the Survivor winner is called out for the week after being crowned, then the column goes (the link stays with the Big Board)", () => {
  const crowned = { ...homeResponse("regular-in"), survivorComplete: true, survivorChampionPlayerId: "p2", survivorChampionName: "Zac" };
  const board = boardResponse("upcoming-picked");
  const day = 86_400_000;
  const soon = realBoardView({ home: { ...crowned, survivorCrownedAt: new Date(Date.parse(board.serverTime) - 3 * day).toISOString() }, board });
  assert.equal(soon.champion, "Zac");
  assert.equal(soon.showSurvivor, true);
  const later = realBoardView({ home: { ...crowned, survivorCrownedAt: new Date(Date.parse(board.serverTime) - 20 * day).toISOString() }, board });
  assert.equal(later.champion, null);
  assert.equal(later.championId, null);
  assert.equal(later.showSurvivor, false);
});
