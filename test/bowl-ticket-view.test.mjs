import assert from "node:assert/strict";
import test from "node:test";
import { bowlPennant } from "../src/lib/bowl-logos.js";
import { bowlSavedPicks, bowlTicketView } from "../src/lib/bowl-ticket-view.js";

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
  assert.equal(bowlPennant("Vrbo Fiesta Bowl").logo, null);
  assert.equal(bowlPennant("Vrbo Fiesta Bowl").flag, "FIESTA");
});

test("every bowl logo file the pennants name exists", async () => {
  const { BOWL_PENNANTS } = await import("../src/lib/bowl-logos.js");
  const { access } = await import("node:fs/promises");
  for (const entry of BOWL_PENNANTS.filter((item) => item.logo)) await access(new URL(`../public/bowl-logos/${entry.logo}.webp`, import.meta.url));
});
