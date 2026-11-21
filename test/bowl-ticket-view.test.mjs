import assert from "node:assert/strict";
import test from "node:test";
import { bowlPennant } from "../src/lib/bowl-logos.js";
import { bowlSavedPicks, bowlTicketView, cfpRounds } from "../src/lib/bowl-ticket-view.js";

const team = (id, name) => ({ id, full_name: name, short_name: name });
const NOW = Date.parse("2026-12-28T17:00:00Z");
const payload = {
  optedIn: true,
  entryOpen: false,
  season: { championship_game_id: "g4" },
  entry: { championship_total_guess: 51 },
  games: [
    // Final: Ohio State (favourite by 3.5) won 27-20, covered.
    { id: "g1", bowl_name: "Rose Bowl Game presented by Prudential", kickoff_at: "2026-12-27T21:00:00Z", status: "final", away_team_id: "a1", home_team_id: "h1", awayTeam: team("a1", "Indiana"), homeTeam: team("h1", "Ohio State"), away_score: 20, home_score: 27, line: { favorite_team_id: "h1", locked_spread: 3.5 } },
    // Kicked off, no pick: missed.
    { id: "g2", bowl_name: "Valero Alamo Bowl", kickoff_at: "2026-12-28T16:00:00Z", status: "in_progress", away_team_id: "a2", home_team_id: "h2", awayTeam: team("a2", "Texas Tech"), homeTeam: team("h2", "Oregon"), line: { favorite_team_id: "h2", locked_spread: 7.5 } },
    // Still open, no pick: owed.
    { id: "g3", bowl_name: "Snoozeville Mattress Bowl", kickoff_at: "2026-12-30T20:00:00Z", status: "scheduled", away_team_id: "a3", home_team_id: "h3", awayTeam: team("a3", "Duke"), homeTeam: team("h3", "Arizona"), line: null },
    // Still open, picked (the underdog).
    { id: "g4", bowl_name: "CFP National Championship", kickoff_at: "2027-01-19T00:30:00Z", status: "scheduled", away_team_id: "a4", home_team_id: "h4", awayTeam: team("a4", "Miami"), homeTeam: team("h4", "Georgia"), line: { favorite_team_id: "h4", locked_spread: 2.5 } },
    // Cancelled: nothing to pick, and decided.
    { id: "g5", bowl_name: "Sun Bowl", kickoff_at: "2026-12-31T19:00:00Z", status: "cancelled", away_team_id: "a5", home_team_id: "h5", awayTeam: team("a5", "LSU"), homeTeam: team("h5", "Utah"), line: null },
  ],
  ownPicks: [{ game_id: "g1", selected_team_id: "h1", result: "win" }, { game_id: "g4", selected_team_id: "a4", result: null }],
  ownPreviewSelections: [],
  standings: [{ playerId: "p1", playerName: "Earl", wins: 3, losses: 1 }, { playerId: "p2", playerName: "Walt", wins: 3, losses: 1 }, { playerId: "p3", playerName: "Bev", wins: 1, losses: 3 }],
};

test("the Bowl ticket marks each bowl owed, picked, missed, done or off, and counts what is owed and decided", () => {
  const view = bowlTicketView(payload, { now: NOW, viewerPlayerId: "p2" });
  assert.deepEqual(view.games.map((game) => game.state), ["done", "missed", "owed", "picked", "off"]);
  assert.equal(view.owed, 1);
  assert.equal(view.decided, 2);
  assert.equal(view.total, 5);
  assert.equal(view.guess, "51");
  assert.equal(view.games[3].tiebreaker, true);
  assert.equal(view.games[3].mine, "underdog");
  assert.equal(view.games[0].result, "W");
  // The sponsor's "presented by" tail is left off the bowl's name.
  assert.equal(view.games[0].bowl, "Rose Bowl Game");
});

test("a finished bowl shows each side's score, its line, and who covered", () => {
  const [rose] = bowlTicketView(payload, { now: NOW }).games;
  assert.deepEqual(rose.cells.map((cell) => [cell.name, cell.line, cell.score, cell.covered]), [["Indiana", "+3.5", 20, false], ["Ohio State", "-3.5", 27, true]]);
  const open = bowlTicketView(payload, { now: NOW }).games[2];
  assert.deepEqual(open.cells.map((cell) => cell.line), ["—", "—"]);
  assert.deepEqual(open.cells.map((cell) => cell.score), [null, null]);
});

test("the standings place ties together and mark the viewer", () => {
  const { standings } = bowlTicketView(payload, { now: NOW, viewerPlayerId: "p2" });
  assert.deepEqual(standings.map((row) => [row.name, row.place, row.tied, row.you]), [["Earl", 1, true, false], ["Walt", 1, true, true], ["Bev", 3, false, false]]);
});

test("saved picks come from the picks and from placeholder picks made before a game had its line", () => {
  assert.deepEqual(bowlSavedPicks({ ...payload, ownPreviewSelections: [{ game_id: "g3", side: "favorite" }] }), { g3: "favorite", g1: "favorite", g4: "underdog" });
});

test("a known bowl flies its logo in its own colours, whatever the sponsor; an unknown one its short name", () => {
  assert.equal(bowlPennant("CFP Semifinal at the Goodyear Cotton Bowl Classic").logo, "cotton");
  assert.equal(bowlPennant("Rose Bowl Game presented by Prudential").logo, "rose");
  assert.equal(bowlPennant("College Football Playoff National Championship").logo, "championship");
  assert.equal(bowlPennant("Valero Alamo Bowl").cloth, "rgb(192 26 30)");
  assert.deepEqual(bowlPennant("Snoozeville Mattress Bowl"), { flag: "SNOOZEVILLE MATTRESS", logo: null, cloth: null, hoist: null });
  assert.equal(bowlPennant("Vrbo Fiesta Bowl").logo, "fiesta");
  assert.equal(bowlPennant("Rate Bowl").logo, "rate");
  assert.equal(bowlPennant("Duke's Mayo Bowl").logo, "dukes-mayo");
  assert.equal(bowlPennant("Snoop Dogg Arizona Bowl presented by Gin & Juice").logo, "arizona");
});

test("every bowl logo file the pennants name exists", async () => {
  const { BOWL_PENNANTS } = await import("../src/lib/bowl-logos.js");
  const { access } = await import("node:fs/promises");
  for (const entry of BOWL_PENNANTS.filter((item) => item.logo)) await access(new URL(`../public/bowl-logos/${entry.logo}.webp`, import.meta.url));
});

test("a bowl saved by its short name alone still flies its own logo", () => {
  assert.equal(bowlPennant("Boca Raton").logo, "boca-raton");
  assert.equal(bowlPennant("Gasparilla").logo, "gasparilla");
  assert.equal(bowlPennant("Duke's Mayo").logo, "dukes-mayo");
  assert.equal(bowlPennant("Frisco Football Classic").logo, "frisco-classic");
  assert.equal(bowlPennant("CFP First Round 1").logo, null);   // a campus playoff game has no bowl of its own
});

test("the Bowl sheet: each player's school once a bowl kicks off, a lamp before (lit for a pick in, unlit for none), your own picks always", () => {
  const team = (id, abbreviation) => ({ id, abbreviation, short_name: abbreviation });
  const payload = {
    games: [
      { id: "g1", bowl_name: "Rose Bowl Game", kickoff_at: "2026-12-30T21:00:00Z", status: "final", away_team_id: "a", home_team_id: "h", awayTeam: team("a", "IND"), homeTeam: team("h", "OSU"), away_score: 20, home_score: 27, line: { favorite_team_id: "h", locked_spread: 3.5 } },
      { id: "g2", bowl_name: "Sugar Bowl", kickoff_at: "2027-01-01T21:00:00Z", status: "scheduled", away_team_id: "b", home_team_id: "c", awayTeam: team("b", "UGA"), homeTeam: team("c", "TEX"), line: { favorite_team_id: "b", locked_spread: 2.5 } },
    ],
    standings: [{ playerId: "p1", playerName: "Earl", wins: 1, losses: 0 }, { playerId: "me", playerName: "Tyler", wins: 0, losses: 1 }, { playerId: "p3", playerName: "Walt", wins: 0, losses: 0 }],
    publicPicks: [{ playerId: "p1", game_id: "g1", selected_team_id: "h", result: "win" }],
    privatePickMarkers: [{ playerId: "p1", game_id: "g2" }],
    ownPicks: [{ game_id: "g1", selected_team_id: "a", result: "loss" }, { game_id: "g2", selected_team_id: "c", result: null }],
  };
  const { sheet } = bowlTicketView(payload, { now: Date.parse("2026-12-31T15:00:00Z"), viewerPlayerId: "me" });
  assert.deepEqual(sheet.games.map((game) => game.name), ["Rose Bowl Game", "Sugar Bowl (SF)"]);
  assert.deepEqual(sheet.games[0].matchup, [{ team: "OSU", line: "-3.5" }, { team: "IND", line: "+3.5" }]);   // favourite over underdog, each with its line
  const row = (name) => sheet.rows.find((candidate) => candidate.name === name).cells;
  assert.deepEqual(row("Earl"), [{ kind: "pick", team: "OSU", result: "W" }, { kind: "hidden" }]);
  assert.deepEqual(row("Tyler"), [{ kind: "pick", team: "IND", result: "L" }, { kind: "pick", team: "TEX", result: null }]);
  assert.deepEqual(row("Walt"), [{ kind: "none", result: null, missed: true }, { kind: "none", result: null, missed: false }]);
});

test("a line whose favourite is neither school still gives the two schools different sides, so picking one never picks both", () => {
  const view = bowlTicketView({ games: [{ id: "g", bowl_name: "Sun Bowl", kickoff_at: "2026-12-31T19:00:00Z", status: "scheduled", away_team_id: "a", home_team_id: "h", awayTeam: { id: "a", short_name: "Duke" }, homeTeam: { id: "h", short_name: "Utah" }, line: { favorite_team_id: "someone-else", locked_spread: 3 } }] }, { now: Date.parse("2026-12-20T12:00:00Z") });
  assert.deepEqual(view.games[0].cells.map((cell) => cell.side), ["favorite", "underdog"]);
  const noTeams = bowlTicketView({ games: [{ id: "g", bowl_name: "Sun Bowl", kickoff_at: "2026-12-31T19:00:00Z", status: "scheduled" }] }, { now: Date.parse("2026-12-20T12:00:00Z") });
  assert.deepEqual(noTeams.games[0].cells.map((cell) => cell.side), ["favorite", "underdog"]);
});

test("the playoff's rounds come from the schedule: the last two playoff games before the title game are the semifinals, the four before them the quarterfinals, earlier ones the first round", () => {
  const at = (day) => `2026-12-${String(day).padStart(2, "0")}T20:00:00Z`;
  const games = [
    ...[19, 19, 20, 20].map((day, i) => ({ id: `fr${i}`, bowl_name: "CFP First Round", kickoff_at: at(day), is_cfp: true })),
    ...["Cotton Bowl", "Orange Bowl", "Rose Bowl Game", "Sugar Bowl"].map((bowl_name, i) => ({ id: `qf${i}`, bowl_name, kickoff_at: at(31), is_cfp: true })),
    { id: "sf0", bowl_name: "Fiesta Bowl", kickoff_at: "2027-01-08T00:30:00Z", is_cfp: true },
    { id: "sf1", bowl_name: "Peach Bowl", kickoff_at: "2027-01-09T00:30:00Z", is_cfp: true },
    { id: "nc", bowl_name: "CFP National Championship", kickoff_at: "2027-01-20T00:30:00Z", is_cfp: true },
    { id: "b", bowl_name: "Sun Bowl", kickoff_at: at(31), is_cfp: false },
  ];
  const rounds = cfpRounds(games, "nc");
  assert.deepEqual(["fr0", "qf2", "sf0", "sf1", "nc"].map((id) => rounds.get(id)), ["First Round", "Quarterfinal", "Semifinal", "Semifinal", "Championship"]);
  assert.equal(rounds.has("b"), false);
  const view = bowlTicketView({ season: { championship_game_id: "nc" }, games }, { now: Date.parse("2026-12-01T12:00:00Z") });
  assert.equal(view.games.find((game) => game.id === "qf2").round, "Quarterfinal");
  assert.equal(view.sheet.games.find((game) => game.id === "sf0").name, "Fiesta Bowl (SF)");
  assert.equal(view.sheet.games.find((game) => game.id === "qf2").name, "Rose Bowl Game (QF)");
});

test("a word boundary in the bowl-name rules is a real one (CFP and Sun Bowl names are recognised)", () => {
  assert.equal(bowlPennant("Tony the Tiger Sun Bowl").logo, "sun");
  assert.equal(bowlPennant("LA Bowl Hosted by Gronk").logo, "la");
  const view = bowlTicketView({ games: [{ id: "g", bowl_name: "CFP at the Rose Bowl", kickoff_at: "2026-12-31T20:00:00Z" }] }, { now: Date.parse("2026-12-01T12:00:00Z") });
  assert.equal(view.games[0].playoff, true);
});

test("the tiebreaker sits on the title game even before the season has named it: the game called the National Championship, else the last playoff game", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const named = bowlTicketView({ season: { championship_game_id: null }, games: [
    { id: "s", bowl_name: "Sugar Bowl", kickoff_at: "2027-01-15T00:30:00Z", is_cfp: true },
    { id: "nc", bowl_name: "College Football Playoff National Championship", kickoff_at: "2027-01-26T00:30:00Z", is_cfp: true },
  ] }, { now });
  assert.deepEqual(named.games.map((game) => game.tiebreaker), [false, true]);
  const unnamed = bowlTicketView({ season: {}, games: [
    { id: "s", bowl_name: "Sugar Bowl", kickoff_at: "2027-01-15T00:30:00Z", is_cfp: true },
    { id: "f", bowl_name: "Final", kickoff_at: "2027-01-26T00:30:00Z", is_cfp: true },
    { id: "b", bowl_name: "Sun Bowl", kickoff_at: "2026-12-31T19:00:00Z", is_cfp: false },
  ] }, { now });
  assert.deepEqual(unnamed.games.map((game) => game.tiebreaker), [false, true, false]);
});
