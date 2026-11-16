import test from "node:test";
import assert from "node:assert/strict";
import { bowlSeason, clubhouseFeed, kickoffLabel, lineFor, placedStandings } from "../src/lib/clubhouse-feed.js";

const game = (id, away, home, extra = {}) => ({
  id, awayTeamId: away.toLowerCase(), homeTeamId: home.toLowerCase(), awayTeamAbbreviation: away, homeTeamAbbreviation: home,
  favoriteTeamId: home.toLowerCase(), officialSpread: 3, preliminarySpread: null, kickoffAt: "2026-11-15T18:00:00Z", status: "scheduled",
  awayResult: null, homeResult: null, ...extra,
});
const home = (extra = {}) => ({
  viewerPlayerId: "me", week: "Week 11", weekStatus: "active", maxPicks: 2, serverTime: "2026-11-15T12:00:00Z", survivorAvailable: true,
  rows: [{ id: "a", firstName: "Earl", wins: 15 }, { id: "me", firstName: "Tyler", wins: 13 }, { id: "b", firstName: "Walt", wins: 13 }],
  survivorRows: [{ playerId: "me", status: "active" }, { playerId: "a", status: "eliminated" }, { playerId: "b", status: "active" }],
  ...extra,
});
const board = (extra = {}) => ({
  serverTime: "2026-11-15T12:00:00Z",
  games: [game("g1", "PIT", "CLE"), game("g2", "IND", "WAS", { favoriteTeamId: "ind" }), game("g3", "SF", "DEN", { officialSpread: 0 })],
  myPicks: [{ gameId: "g1", teamId: "pit" }],
  survivor: { available: true, status: "active", pick: null },
  ...extra,
});

test("lines read as a pick of that team reads them, with PK for none and a dash before there is a line", () => {
  const g = game("g", "PIT", "CLE");
  assert.equal(lineFor(g, "cle"), "-3");
  assert.equal(lineFor(g, "pit"), "+3");
  assert.equal(lineFor({ ...g, officialSpread: 0 }, "pit"), "PK");
  assert.equal(lineFor({ ...g, officialSpread: null, preliminarySpread: 2.5 }, "cle"), "-2.5");
  assert.equal(lineFor({ ...g, officialSpread: null }, "cle"), "—");
});

test("kickoffs are Eastern, weekday and time", () => {
  assert.equal(kickoffLabel("2026-11-15T18:00:00Z"), "Sun 1:00 PM");
  assert.equal(kickoffLabel(null), "TBA");
});

test("level players share a place", () => {
  assert.deepEqual(placedStandings(home().rows).map((row) => [row.name, row.place, row.tied]), [["Earl", 1, false], ["Tyler", 2, true], ["Walt", 2, true]]);
});

test("the Bowl Pool is wheeled in from Dec 7 Eastern through January", () => {
  assert.equal(bowlSeason("2026-12-07T04:00:00Z"), false);   // still Dec 6, 11 PM Eastern
  assert.equal(bowlSeason("2026-12-07T06:00:00Z"), true);
  assert.equal(bowlSeason("2027-01-20T12:00:00Z"), true);
  assert.equal(bowlSeason("2027-02-02T12:00:00Z"), false);
});

test("the room lights only your own picks, says what is owed, and the ticket has a lamp a pick then Survivor's", () => {
  const { feed, ticket } = clubhouseFeed({ home: home(), board: board() });
  assert.deepEqual(feed.mine, ["PIT"]);
  assert.deepEqual(feed.games.map((g) => [g.away, g.awayLine, g.home, g.homeLine]), [["PIT", "+3", "CLE", "-3"], ["IND", "-3", "WAS", "+3"], ["SF", "PK", "DEN", "PK"]]);
  assert.equal(feed.news.board, "Earl leads · You: T2");
  assert.equal(feed.news.picks, "2 owed");
  assert.equal(feed.news.survivor, "2 of 3 still in · You’re in");
  assert.equal(feed.owed, true);
  assert.deepEqual(ticket.lamps, ["in", "off", "off"]);
  assert.equal(ticket.line, "1 of 3 in · 2 still to make");
});

test("graded picks light green or red; all in says so; a finished week owes nothing", () => {
  const graded = board({
    games: [game("g1", "PIT", "CLE", { status: "final", awayResult: "win", homeResult: "loss" }), game("g2", "IND", "WAS", { status: "final", awayResult: "loss", homeResult: "win" }), game("g3", "SF", "DEN")],
    myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }],
    survivor: { available: true, status: "active", pick: { game_id: "g3", selected_team_id: "sf" } },
  });
  const live = clubhouseFeed({ home: home(), board: graded });
  assert.deepEqual(live.ticket.lamps, ["won", "lost", "in"]);
  assert.equal(live.ticket.line, "All 3 in · change any until its kickoff");
  assert.equal(live.feed.news.picks, "All in");
  const done = clubhouseFeed({ home: home({ weekStatus: "complete" }), board: board() });
  assert.equal(done.feed.owed, false);
});

test("out of Survivor: no Survivor lamp; no games: no ticket and a dark spreads board", () => {
  const out = clubhouseFeed({ home: home(), board: board({ survivor: { available: true, status: "eliminated", pick: null } }) });
  assert.equal(out.ticket.lamps.length, 2);
  const empty = clubhouseFeed({ home: home({ rows: [] }), board: board({ games: [], myPicks: [] }) });
  assert.equal(empty.ticket, null);
  assert.deepEqual(empty.feed.games, []);
  assert.equal("board" in empty.feed.news, false);
});

test("Survivor leaves the room when it leaves the classic pages: decided, or the playoffs (and its news line goes with it)", () => {
  assert.equal(clubhouseFeed({ home: home(), board: board() }).feed.survivorOver, false);
  const decided = clubhouseFeed({ home: home({ survivorComplete: true }), board: board() }).feed;
  assert.equal(decided.survivorOver, true);
  assert.equal("survivor" in decided.news, false);
  assert.equal(clubhouseFeed({ home: home({ isPlayoff: true }), board: board() }).feed.survivorOver, true);
});

test("the ticker shows a final score and which side covered, and nothing for a game still to play or in play", () => {
  const finalGame = game("g1", "PIT", "CLE", { status: "final", awayScore: 17, homeScore: 14, favoriteTeamId: "pit", officialSpread: 2.5, awayResult: "win", homeResult: "loss" });
  const live = game("g2", "IND", "WAS", { status: "live", awayScore: 7, homeScore: 3 });
  const feed = clubhouseFeed({ home: home(), board: board({ games: [finalGame, live] }) }).feed;
  assert.deepEqual(feed.games[0].final, { away: { score: 17, covered: true }, home: { score: 14, covered: false } });
  assert.equal("final" in feed.games[1], false);   // no live scores
  // A push is a miss for both sides.
  const push = game("g3", "SF", "DEN", { status: "final", awayScore: 20, homeScore: 17, favoriteTeamId: "sf", officialSpread: 3, awayResult: null, homeResult: null });
  assert.deepEqual(clubhouseFeed({ home: home(), board: board({ games: [push] }) }).feed.games[0].final, { away: { score: 20, covered: false }, home: { score: 17, covered: false } });
});
