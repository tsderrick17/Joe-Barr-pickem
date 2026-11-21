import test from "node:test";
import assert from "node:assert/strict";
import { bowlSeason, clubhouseFeed, kickoffLabel, lineFor, placedStandings, survivorStillShown, bowlTickerGames, mergeTicker } from "../src/lib/clubhouse-feed.js";

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
  assert.equal(feed.news.board, "Earl leads · You: T2, 2 back");
  assert.equal(feed.news.picks, "2 owed");
  assert.equal(feed.news.survivor, "2 of 3 still in · You’re in");
  assert.equal(feed.owed, true);
  assert.deepEqual(ticket.lamps, ["in", "off", "off"]);
  assert.equal(ticket.line, "2 picks to make");
});

test("graded picks light green or red; all in says so; a finished week owes nothing", () => {
  const graded = board({
    games: [game("g1", "PIT", "CLE", { status: "final", awayResult: "win", homeResult: "loss" }), game("g2", "IND", "WAS", { status: "final", awayResult: "loss", homeResult: "win" }), game("g3", "SF", "DEN")],
    myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }],
    survivor: { available: true, status: "active", pick: { game_id: "g3", selected_team_id: "sf" } },
  });
  const live = clubhouseFeed({ home: home(), board: graded });
  assert.deepEqual(live.ticket.lamps, ["won", "lost", "in"]);
  assert.equal(live.ticket.line, "All in · change until kickoff");
  assert.equal(live.feed.news.picks, "All in");
  const done = clubhouseFeed({ home: home({ weekStatus: "complete" }), board: board() });
  assert.equal(done.feed.owed, false);
});

test("all in with every pick's game kicked off: the ticket says all locked, not that a pick can still change", () => {
  const started = { status: "live", kickoffAt: "2026-11-15T11:00:00Z" };
  const locked = board({
    games: [game("g1", "PIT", "CLE", started), game("g2", "IND", "WAS", started), game("g3", "SF", "DEN"), game("g4", "NYG", "DAL", started)],
    myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }],
    survivor: { available: true, status: "active", pick: { game_id: "g4", selected_team_id: "nyg" } },
  });
  assert.equal(clubhouseFeed({ home: home(), board: locked }).ticket.line, "All in · all locked");
  // The Survivor team's game still to come: that one can change.
  const open = { ...locked, survivor: { available: true, status: "active", pick: { game_id: "g3", selected_team_id: "sf" } } };
  assert.equal(clubhouseFeed({ home: home(), board: open }).ticket.line, "All in · change until kickoff");
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

test("the ticket's last lamp is Survivor's only while the viewer is still in Survivor", () => {
  assert.equal(clubhouseFeed({ home: home(), board: board() }).ticket.survivor, true);
  assert.equal(clubhouseFeed({ home: home(), board: board({ survivor: { available: true, status: "eliminated", pick: null } }) }).ticket.survivor, false);
});

test("the Big Board's standings move week over week: places climbed or slipped since last week, and the plate says where you are", async () => {
  const { boardNews, placedStandings, withMovement } = await import("../src/lib/clubhouse-feed.js");
  const rows = [{ id: "a", firstName: "Earl", wins: 12 }, { id: "b", firstName: "Walt", wins: 11 }, { id: "c", firstName: "Rosie", wins: 9 }];
  // Last week Walt led, Earl was second, Rosie third.
  const moved = withMovement(placedStandings(rows), rows, { a: 9, b: 10, c: 8 });
  assert.deepEqual(moved.map((row) => [row.name, row.move]), [["Earl", 1], ["Walt", -1], ["Rosie", 0]]);
  assert.equal(withMovement(placedStandings(rows), rows, null)[0].move, undefined);
  assert.equal(boardNews(moved, "a"), "You lead by 1 · ▲1");
  assert.equal(boardNews(moved, "b"), "Earl leads · You: 2, 1 back · ▼1");
  assert.equal(boardNews(moved, "c"), "Earl leads · You: 3, 3 back");
  const level = placedStandings([{ id: "a", firstName: "Earl", wins: 12 }, { id: "b", firstName: "Walt", wins: 12 }]);
  assert.equal(boardNews(level, "a"), "You share the lead");
  assert.equal(boardNews(level, "z"), "2 lead");
});

test("the ▲▼ counts ties as shared places: still tied is no move, breaking a tie or joining one moves only as far as the shared place", async () => {
  const { placedStandings, withMovement } = await import("../src/lib/clubhouse-feed.js");
  const moves = (now, before) => {
    const rows = Object.entries(now).map(([id, wins]) => ({ id, firstName: id, wins }));
    return Object.fromEntries(withMovement(placedStandings(rows), rows, before).map((row) => [row.id, row.move]));
  };
  // Tied for 2nd last week and still tied for 2nd: nobody moved, whatever the alphabet puts first.
  assert.deepEqual(moves({ a: 10, b: 8, c: 8, d: 5 }, { a: 9, b: 7, c: 7, d: 5 }), { a: 0, b: 0, c: 0, d: 0 });
  // A tie for 2nd broken: the one who pulled ahead stays 2nd (no move), the one left behind slips to 3rd (▼1).
  assert.deepEqual(moves({ a: 10, b: 9, c: 8, d: 5 }, { a: 9, b: 7, c: 7, d: 5 }), { a: 0, b: 0, c: -1, d: 0 });
  // Alone in 4th, now level with two others for 2nd: up 2 places (▲2), and the two already 2nd and 3rd neither climb nor fall unfairly.
  assert.deepEqual(moves({ a: 10, b: 8, c: 8, d: 8 }, { a: 9, b: 8, c: 7, d: 6 }), { a: 0, b: 0, c: 1, d: 2 });
  // Everyone level (the season's first week): all share 1st, so last week's order does not count as falling.
  assert.deepEqual(moves({ a: 1, b: 1, c: 1 }, { a: 0, b: 0, c: 0 }), { a: 0, b: 0, c: 0 });
});

test("Survivor stays on the screens while it runs and for 8 days after it is decided, never in the playoffs or once it has gone", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(survivorStillShown({ survivorAvailable: true }, now), true);
  assert.equal(survivorStillShown({ survivorAvailable: true, survivorComplete: true, survivorCrownedAt: "2026-11-15T12:00:00Z" }, now), true);
  assert.equal(survivorStillShown({ survivorAvailable: true, survivorComplete: true, survivorCrownedAt: "2026-11-05T12:00:00Z" }, now), false);
  assert.equal(survivorStillShown({ survivorAvailable: true, isPlayoff: true }, now), false);
  assert.equal(survivorStillShown({ survivorAvailable: false }, now), false);
});

test("the ticker's bowls: three days either side, finals with who covered against the locked line, the viewer's pick lit, cancelled ones left off", () => {
  const now = Date.parse("2026-12-27T18:00:00Z");
  const team = (id, abbreviation, short_name) => ({ id, abbreviation, short_name });
  const payload = {
    ownPicks: [{ game_id: "b1", selected_team_id: "uga" }],
    games: [
      { id: "b1", bowl_name: "Sugar Bowl", kickoff_at: "2026-12-26T01:00:00Z", status: "final", away_team_id: "ind", home_team_id: "uga", awayTeam: team("ind", "IND"), homeTeam: team("uga", "UGA"), away_score: 20, home_score: 24, line: { favorite_team_id: "uga", locked_spread: 3.5 } },
      { id: "b2", bowl_name: "Snoozeville Mattress Bowl", kickoff_at: "2026-12-29T20:00:00Z", status: "scheduled", away_team_id: "d", home_team_id: "a", awayTeam: team("d", null, "Duke"), homeTeam: team("a", "ARIZ"), line: null },
      { id: "b3", bowl_name: "Rose Bowl Game", kickoff_at: "2027-01-05T21:00:00Z", status: "scheduled", away_team_id: "x", home_team_id: "y", awayTeam: team("x", "X"), homeTeam: team("y", "Y") },
      { id: "b4", bowl_name: "Gator Bowl", kickoff_at: "2026-12-27T20:00:00Z", status: "cancelled", away_team_id: "p", home_team_id: "q", awayTeam: team("p", "P"), homeTeam: team("q", "Q") },
    ],
  };
  const games = bowlTickerGames(payload, now);
  assert.deepEqual(games.map((game) => game.id), ["bowl-b1", "bowl-b2"]);
  assert.deepEqual(games[0].final, { away: { score: 20, covered: false }, home: { score: 24, covered: true } });
  assert.equal(games[0].picked, "home");
  assert.equal(games[0].bowl, "SUGAR");
  assert.equal(games[0].homeLine, "-3.5");
  assert.equal(games[1].away, "DUKE");
  assert.equal(games[1].awayLine, "—");
});

test("the ticker's order: today's NFL games, then today's bowls, then two NFL games to a bowl", () => {
  const now = Date.parse("2026-12-27T15:00:00Z");   // Sunday morning, Eastern
  const at = (iso) => Date.parse(iso);
  const nfl = [{ id: "n-today-1", at: at("2026-12-27T18:00:00Z") }, { id: "n-today-2", at: at("2026-12-27T21:25:00Z") }, { id: "n-mon", at: at("2026-12-29T01:15:00Z") }, { id: "n-sat", at: at("2026-12-26T21:30:00Z") }, { id: "n-thu", at: at("2026-12-25T01:15:00Z") }];
  const bowls = [{ id: "b-later", at: at("2026-12-29T20:00:00Z") }, { id: "b-today", at: at("2026-12-27T20:00:00Z") }, { id: "b-past", at: at("2026-12-26T01:00:00Z") }];
  assert.deepEqual(mergeTicker(nfl, bowls, now).map((game) => game.id), ["n-today-1", "n-today-2", "b-today", "n-mon", "n-sat", "b-past", "n-thu", "b-later"]);
});

test("the paper slip: a box a pick with its line and kickoff, open boxes, Survivor last, and the lock time while picks are owed", () => {
  const { ticket } = clubhouseFeed({ home: home(), board: board() });
  assert.deepEqual(ticket.slots.map((slot) => [slot.text, slot.note, slot.state, Boolean(slot.survivor)]), [
    ["PIT +3", "SUN 1:00", "in", false], ["PICK", "OPEN", "off", false], ["SURVIVOR", "OPEN", "off", true],
  ]);
  assert.equal(ticket.corner, "Locks Sun 1:00 PM");
  assert.equal(ticket.urgent, true);
  assert.equal(ticket.action, "PICK");
  const done = clubhouseFeed({ home: home(), board: board({
    games: [game("g1", "PIT", "CLE", { status: "final", awayScore: 27, homeScore: 20, awayResult: "win" }), game("g2", "IND", "WAS", { status: "scheduled", kickoffAt: "2026-11-15T21:25:00Z" })],
    myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }],
    survivor: { available: true, status: "active", pick: { game_id: "g2", selected_team_id: "was" } },
  }) }).ticket;
  assert.deepEqual(done.slots.map((slot) => slot.note), ["WON 27–20", "SUN 4:25", "SURVIVOR"]);
  assert.equal(done.slots[2].text, "WAS");
  assert.equal(done.corner, "You’re tied 2nd, 2 back");
  assert.equal(done.action, "VIEW");
});
