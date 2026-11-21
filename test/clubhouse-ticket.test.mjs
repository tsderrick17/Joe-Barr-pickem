import test from "node:test";
import assert from "node:assert/strict";
import { roomTicket } from "../src/lib/clubhouse-ticket.js";

// Every state the ticket at the foot of the clubhouse can be in, regular weeks and playoff rounds alike (see clubhouse-ticket.js).

const NOW = "2026-11-15T12:00:00Z";   // Sunday morning, Eastern
const game = (id, away, home, extra = {}) => ({
  id, awayTeamId: away.toLowerCase(), homeTeamId: home.toLowerCase(), awayTeamAbbreviation: away, homeTeamAbbreviation: home,
  favoriteTeamId: home.toLowerCase(), officialSpread: 3, preliminarySpread: null, kickoffAt: "2026-11-15T18:00:00Z", status: "scheduled",
  awayScore: null, homeScore: null, awayResult: null, homeResult: null, ...extra,
});
const final = (away, home, awayResult) => ({ status: "final", awayScore: away, homeScore: home, awayResult, homeResult: awayResult === "win" ? "loss" : awayResult === "loss" ? "win" : null });
const week = (extra = {}) => ({ week: "Week 11", weekStatus: "active", maxPicks: 2, serverTime: NOW, ...extra });
const board = (extra = {}) => ({
  serverTime: NOW,
  games: [game("g1", "PIT", "CLE"), game("g2", "IND", "WAS", { favoriteTeamId: "ind", kickoffAt: "2026-11-15T21:25:00Z" }), game("g3", "SF", "DEN", { kickoffAt: "2026-11-16T01:20:00Z" })],
  myPicks: [],
  survivor: { available: true, status: "active", pick: null },
  pickem: { playoffEliminated: false },
  ...extra,
});
const places = (ticket) => ticket.places.map((place) => [place.team ?? place.label, place.note, place.state]);

test("nothing picked: every place open and named, the stub counts what is left", () => {
  const ticket = roomTicket({ home: week(), board: board() });
  assert.deepEqual(places(ticket), [["Pick 1", "Open", "off"], ["Pick 2", "Open", "off"], ["Survivor", "Open", "off"]]);
  assert.equal(ticket.status, null);   // nothing in the corner: the stub counts what is left
  assert.deepEqual([ticket.action, ticket.stub], ["PICK", "3 LEFT"]);
});

test("some picked: picks by team in kickoff order, line without a leading minus fuss, the rest open", () => {
  const ticket = roomTicket({ home: week(), board: board({ myPicks: [{ gameId: "g2", teamId: "ind" }] }) });
  assert.deepEqual(ticket.places[0], { team: "IND", line: "-3", label: "", note: "Sun 4:25", state: "in" });
  assert.deepEqual(places(ticket).slice(1), [["Pick 2", "Open", "off"], ["Survivor", "Open", "off"]]);
  assert.equal(ticket.stub, "2 LEFT");
});

test("all in and still changeable; all in and every game under way", () => {
  const all = { myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }], survivor: { available: true, status: "active", pick: { game_id: "g3", selected_team_id: "den" } } };
  const open = roomTicket({ home: week(), board: board(all) });
  assert.deepEqual([open.action, open.stub, open.status], ["VIEW", "ALL IN", { label: "All in", text: "Change until kickoff" }]);
  assert.deepEqual(open.places[2], { team: "DEN", label: "Survivor", note: "Sun 8:20", state: "in", survivor: true });   // Survivor by its logo
  const later = roomTicket({ home: week({ serverTime: "2026-11-16T02:00:00Z" }), board: board({ ...all, serverTime: "2026-11-16T02:00:00Z", games: board().games.map((g) => ({ ...g, status: "live" })) }) });
  assert.deepEqual(later.status, { label: "All in", text: "Locked" });
  assert.deepEqual(later.places.map((place) => place.note), ["Live", "Live", "Live"]);
});

test("game day: a pick decided against the spread, a push said plainly as a loss, Survivor straight up", () => {
  const games = [
    game("g1", "PIT", "CLE", final(27, 20, "win")),                          // PIT +3 covers
    game("g2", "IND", "WAS", { favoriteTeamId: "ind", ...final(23, 20, "loss") }),   // IND -3 pushes: a loss
    game("g3", "SF", "DEN", { kickoffAt: "2026-11-16T01:20:00Z", ...final(17, 17, null) }),
  ];
  const ticket = roomTicket({ home: week(), board: board({ games, myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }], survivor: { available: true, status: "active", pick: { game_id: "g3", selected_team_id: "sf" } } }) });
  assert.deepEqual(places(ticket), [["PIT", "Won 27–20", "won"], ["IND", "Push · loss", "lost"], ["SF", "Tie · loss", "lost"]]);
  assert.deepEqual([ticket.status, ticket.stub, ticket.action], [{ label: "Final", text: "1–1" }, "FINAL", "VIEW"]);   // Survivor is not part of the week's record
  assert.deepEqual(ticket.lamps, ["won", "lost", "lost"]);
});

test("a pick never made: missed once nothing is left to put it on, and nothing is owed", () => {
  const games = board().games.map((g) => ({ ...g, status: "live" }));
  const ticket = roomTicket({ home: week({ serverTime: "2026-11-16T02:00:00Z" }), board: board({ serverTime: "2026-11-16T02:00:00Z", games, myPicks: [{ gameId: "g1", teamId: "pit" }] }) });
  assert.deepEqual(places(ticket).slice(1), [["Pick 2", "No pick", "missed"], ["Survivor", "No pick", "missed"]]);
  assert.deepEqual([ticket.owed, ticket.action], [0, "VIEW"]);
  assert.deepEqual(ticket.lamps.slice(1), ["off", "off"]);
});

test("before a line is set a pick shows its team alone; a postponed game says so", () => {
  const games = [game("g1", "PIT", "CLE", { officialSpread: null }), game("g2", "IND", "WAS", { status: "postponed" })];
  const ticket = roomTicket({ home: week(), board: board({ games, myPicks: [{ gameId: "g1", teamId: "pit" }, { gameId: "g2", teamId: "ind" }] }) });
  assert.equal(ticket.places[0].line, "");
  assert.equal(ticket.places[1].note, "Postponed");
});

test("out of Survivor, or Survivor decided: no Survivor place", () => {
  assert.equal(roomTicket({ home: week(), board: board({ survivor: { available: true, status: "eliminated", pick: null } }) }).places.length, 2);
  assert.equal(roomTicket({ home: week(), board: board({ survivor: { available: true, status: "complete", pick: null } }) }).places.length, 2);
});

test("no games, no ticket", () => {
  assert.equal(roomTicket({ home: week(), board: board({ games: [] }) }), null);
});

const round = (count, extra = {}) => ({
  serverTime: "2027-01-10T19:00:00Z",
  games: [["BUF", "KC", "2027-01-10T18:00:00Z", "live"], ["GB", "PHI", "2027-01-10T21:30:00Z"], ["HOU", "BAL", "2027-01-11T01:15:00Z"], ["LAR", "DET", "2027-01-12T01:15:00Z"], ["MIN", "SF", "2027-01-11T18:00:00Z"], ["DEN", "PIT", "2027-01-11T21:30:00Z"]]
    .slice(0, count).map(([away, home, kickoffAt, status = "scheduled"], index) => game(`w${index}`, away, home, { kickoffAt, status })),
  myPicks: [{ gameId: "w1", teamId: "gb" }],
  survivor: { available: false, status: "complete", pick: null },
  pickem: { playoffEliminated: false },
  ...extra,
});
const playoffs = (extra = {}) => week({ isPlayoff: true, week: "Wild Card", maxPicks: 6, serverTime: "2027-01-10T19:00:00Z", ...extra });

test("a playoff round: a place a game in kickoff order, open ones by matchup, a game kicked off without a pick missed, no Survivor", () => {
  const ticket = roomTicket({ home: playoffs(), board: round(6) });
  assert.deepEqual(places(ticket), [
    ["BUF @ KC", "No pick", "missed"], ["GB", "Sun 4:30", "in"], ["HOU @ BAL", "Open", "off"],
    ["MIN @ SF", "Open", "off"], ["DEN @ PIT", "Open", "off"], ["LAR @ DET", "Open", "off"],
  ]);
  assert.deepEqual([ticket.stub, ticket.survivor], ["4 LEFT", false]);
});

test("every playoff round size has a place a game: 6, 4, 2 and 1", () => {
  for (const count of [6, 4, 2, 1]) assert.equal(roomTicket({ home: playoffs({ maxPicks: count }), board: round(count, { myPicks: [] }) }).places.length, count);
});

test("out of the playoff race or forfeited: nothing owed, the score stands, no count on the stub", () => {
  const out = roomTicket({ home: playoffs(), board: round(4, { pickem: { playoffEliminated: true } }) });
  assert.deepEqual([out.owed, out.status, out.stub, out.action], [0, { label: "Race over", text: "Score stands" }, "", "VIEW"]);
  assert.ok(out.places.filter((place) => !place.team).every((place) => place.state === "missed"));
  const gone = roomTicket({ home: playoffs(), board: round(4, { pickem: { playoffEliminated: false, forfeit: { available: true, forfeited: true } } }) });
  assert.deepEqual(gone.status, { label: "Forfeited", text: "Score stands" });
});
