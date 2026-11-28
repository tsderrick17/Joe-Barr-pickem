/**
 * The Workshop Lab's "Game states" try-out: the Big Board and your ticket in every state a week can be in, drawn on sample players (no pool
 * data is read). Each state is a `BoardView` for the board and a `RoomTicketData` for the ticket, written out by hand to match what
 * `boardView` (src/lib/board-view.js) and `roomTicket` (src/lib/clubhouse-ticket.js) work out from the real reads, so what the owner sees here
 * is what a player sees in that state.
 *
 * @typedef {import("./board-view.js").BoardView} BoardView
 * @typedef {{ id: string, name: string, about: string, view: BoardView, ticket: import("../components/clubhouse/room-ticket").RoomTicketData }} LabGameState
 */

const NAMES = { BUF: "Bills", KC: "Chiefs", DAL: "Cowboys", PHI: "Eagles", GB: "Packers", DET: "Lions", MIA: "Dolphins", NYJ: "Jets" };

/** One game of the sample week. */
const game = (id, kickoff, kickedOff, away, home, awayLine, homeLine, results = {}) => ({
  id, kickoff, kickedOff, action: true, away, home, awayLine, homeLine, lineFinal: true, results,
});
const side = (ats, su, score, margin) => ({ ats, su, score, margin, pickers: [] });
const slat = (team, line, result = null, hidden = false) => ({ hidden, team: hidden ? null : team, line: hidden ? null : line, result });

/** A regular week's view, with what differs in each state. */
function regular({ status = "", games, rows, mine, survivor = { playing: true, out: false, outWeek: null, left: 6, teams: {} }, canPick = true }) {
  return {
    week: "WEEK 12", status, maxPicks: 2, canPick, weekId: "w12", weeks: [{ id: "w11", name: "Week 11", status: "complete" }, { id: "w12", name: "Week 12", status: "active" }], poolAction: false,
    games, names: NAMES, rows, showSurvivor: survivor.playing, championId: null, champion: null, mine, survivor, ids: {}, playoff: null,
  };
}

const you = (wins, slats, survivor) => ({ id: "you", name: "Tyler", wins, you: true, slats, survivor });
const other = (id, name, wins, slats, survivor, extra = {}) => ({ id, name, wins, you: false, slats, survivor, ...extra });
const hiddenBoth = [slat(null, null, null, true), slat(null, null, null, true)];

const SUN = game("g1", "SUN 1:00", false, "BUF", "KC", "+2.5", "-2.5");
const SNF = game("g2", "SUN 8:20", false, "DAL", "PHI", "+3.5", "-3.5");
const MNF = game("g3", "MON 8:15", false, "GB", "DET", "+6.5", "-6.5");
const done = (g, away, home, awayAts, homeAts) => ({ ...g, kickedOff: true, results: { [g.away]: side(awayAts, awayAts === "W" ? "W" : "L", away, away - home), [g.home]: side(homeAts, homeAts === "W" ? "W" : "L", home, home - away) } });
const live = (g) => ({ ...g, kickedOff: true });

/** The playoff round: a pick for every game, a column a game, the race to catch the leader. */
function playoff({ kicked, race, rows, mine }) {
  const games = [
    kicked >= 1 ? done(game("p1", "SAT 4:30", true, "BUF", "KC", "+2.5", "-2.5"), 24, 27, "W", "L") : game("p1", "SAT 4:30", false, "BUF", "KC", "+2.5", "-2.5"),
    kicked >= 2 ? live(game("p2", "SAT 8:15", true, "DAL", "PHI", "+3.5", "-3.5")) : game("p2", "SAT 8:15", false, "DAL", "PHI", "+3.5", "-3.5"),
    game("p3", "SUN 1:00", false, "GB", "DET", "+6.5", "-6.5"),
    game("p4", "SUN 4:30", false, "MIA", "NYJ", "-1.5", "+1.5"),
  ];
  return {
    week: "WILD CARD", status: "", maxPicks: 4, canPick: !race.you.forfeited && !race.you.out, weekId: "p", weeks: [{ id: "p", name: "Wild Card", status: "active" }], poolAction: false,
    games, names: NAMES, rows, showSurvivor: false, championId: null, champion: null, mine,
    survivor: { playing: false, out: false, outWeek: null, left: 0, teams: {} }, ids: {}, playoff: race,
  };
}

const place = (team, line, state, note, extra = {}) => ({ team, line, label: team, note, state, ...extra });
const open = (label) => ({ label, note: "Open", state: "off" });
const miss = (label) => ({ label, note: "No pick", state: "missed" });

/** @returns {LabGameState[]} */
export function labGameStates() {
  const oneRace = { leaders: ["Dana"], leaderWins: 2, toPlay: 3, you: { back: 1, out: false, forfeited: false, forfeitAvailable: true } };
  const states = [
    {
      id: "owed", name: "Picks owed", about: "Before kickoff, nothing picked yet: the board's PICK rings, the ticket's open places and a count on its stub.",
      view: regular({ games: [SUN, SNF, MNF], mine: { picks: [], survivor: null }, rows: [
        you(0, [null, null], { kind: "owed" }),
        other("e", "Earl", 0, hiddenBoth, { kind: "hidden" }), other("d", "Dana", 0, hiddenBoth, { kind: "hidden" }), other("g", "Gary", 0, hiddenBoth, { kind: "hidden" }), other("p", "Priya", 0, [null, null], { kind: "none" }),
      ] }),
      ticket: { places: [open("Pick 1"), open("Pick 2"), { label: "Survivor", note: "Open", state: "off", survivor: true }], status: null, action: "PICK", stub: "3 LEFT" },
    },
    {
      id: "in", name: "All in, can still change", about: "Every pick made and covered; changeable until each game kicks off.",
      view: regular({ games: [SUN, SNF, MNF], mine: { picks: ["KC", "PHI"], survivor: "DET" }, rows: [
        you(0, [slat("KC", "-2.5"), slat("PHI", "-3.5")], { kind: "pick", team: "DET", result: null }),
        other("e", "Earl", 0, hiddenBoth, { kind: "hidden" }), other("d", "Dana", 0, hiddenBoth, { kind: "hidden" }), other("g", "Gary", 0, hiddenBoth, { kind: "hidden" }), other("p", "Priya", 0, hiddenBoth, { kind: "hidden" }),
      ] }),
      ticket: { places: [place("KC", "-2.5", "in", "Sun 1:00"), place("PHI", "-3.5", "in", "Sun 8:20"), place("DET", "", "in", "Mon 8:15", { survivor: true })], status: { label: "ALL IN", text: "Change until kickoff" }, action: "VIEW", stub: "ALL IN" },
    },
    {
      id: "live", name: "A game under way", about: "The first game has kicked off: its picks show for everyone, the rest stay covered.",
      view: regular({ games: [live(SUN), SNF, MNF], mine: { picks: ["KC", "PHI"], survivor: "DET" }, rows: [
        you(0, [slat("KC", "-2.5"), slat("PHI", "-3.5")], { kind: "pick", team: "DET", result: null }),
        other("e", "Earl", 0, [slat("BUF", "+2.5"), slat(null, null, null, true)], { kind: "hidden" }), other("d", "Dana", 0, [slat("KC", "-2.5"), slat(null, null, null, true)], { kind: "hidden" }),
        other("g", "Gary", 0, hiddenBoth, { kind: "hidden" }), other("p", "Priya", 0, [slat("BUF", "+2.5"), slat(null, null, null, true)], { kind: "hidden" }),
      ] }),
      ticket: { places: [place("KC", "-2.5", "in", "Live"), place("PHI", "-3.5", "in", "Sun 8:20"), place("DET", "", "in", "Mon 8:15", { survivor: true })], status: { label: "ALL IN", text: "Locked" }, action: "VIEW", stub: "ALL IN" },
    },
    {
      id: "results", name: "Results coming in", about: "Some games graded: green wins, red losses on the board; won and lost lamps on the ticket.",
      view: regular({ games: [done(SUN, 20, 27, "L", "W"), done(SNF, 17, 24, "L", "W"), live(MNF)], mine: { picks: ["KC", "DAL"], survivor: "PHI" }, rows: [
        you(1, [slat("KC", "-2.5", "W"), slat("DAL", "+3.5", "L")], { kind: "pick", team: "PHI", result: "W" }),
        other("e", "Earl", 1, [slat("KC", "-2.5", "W"), slat("DET", "-6.5", null)], { kind: "pick", team: "KC", result: "W" }),
        other("d", "Dana", 2, [slat("KC", "-2.5", "W"), slat("PHI", "-3.5", "W")], { kind: "out" }),
        other("g", "Gary", 0, [slat("BUF", "+2.5", "L"), slat("DAL", "+3.5", "L")], { kind: "out" }),
        other("p", "Priya", 1, [slat("PHI", "-3.5", "W"), slat(null, null, null, true)], { kind: "pick", team: "PHI", result: "W" }),
      ] }),
      ticket: { places: [place("KC", "-2.5", "won", "Won 27–20"), place("DAL", "+3.5", "lost", "Lost 17–24"), place("PHI", "", "won", "Won 24–17", { survivor: true })], status: { label: "ALL IN", text: "Locked" }, action: "VIEW", stub: "ALL IN" },
    },
    {
      id: "final", name: "Week final", about: "Every game graded: the week's FINAL, the ticket's score and a view stub.",
      view: regular({ status: "FINAL", canPick: false, games: [done(SUN, 20, 27, "L", "W"), done(SNF, 17, 24, "L", "W"), done(MNF, 21, 17, "W", "L")], mine: { picks: ["KC", "GB"], survivor: "PHI" }, rows: [
        you(2, [slat("KC", "-2.5", "W"), slat("GB", "+6.5", "W")], { kind: "pick", team: "PHI", result: "W" }),
        other("e", "Earl", 1, [slat("KC", "-2.5", "W"), slat("DET", "-6.5", "L")], { kind: "out" }),
        other("d", "Dana", 2, [slat("KC", "-2.5", "W"), slat("PHI", "-3.5", "W")], { kind: "pick", team: "KC", result: "W" }),
        other("g", "Gary", 0, [slat("BUF", "+2.5", "L"), slat("DAL", "+3.5", "L")], { kind: "out" }),
        other("p", "Priya", 1, [slat("PHI", "-3.5", "W"), slat("DET", "-6.5", "L")], { kind: "pick", team: "PHI", result: "W" }),
      ] }),
      ticket: { places: [place("KC", "-2.5", "won", "Won 27–20"), place("GB", "+6.5", "won", "Won 21–17"), place("PHI", "", "won", "Won 24–17", { survivor: true })], status: { label: "FINAL", text: "2–0" }, action: "VIEW", stub: "FINAL" },
    },
    {
      id: "missed", name: "A pick missed", about: "A game kicked off with nothing picked: a fainter ring on the ticket, a loss once the week is final.",
      view: regular({ games: [live(SUN), SNF, MNF], mine: { picks: ["PHI"], survivor: null }, survivor: { playing: true, out: false, outWeek: null, left: 6, teams: {} }, rows: [
        you(0, [slat("PHI", "-3.5"), null], { kind: "none" }),
        other("e", "Earl", 0, [slat("BUF", "+2.5"), slat(null, null, null, true)], { kind: "hidden" }), other("d", "Dana", 0, hiddenBoth, { kind: "hidden" }),
        other("g", "Gary", 0, hiddenBoth, { kind: "hidden" }), other("p", "Priya", 0, hiddenBoth, { kind: "hidden" }),
      ] }),
      ticket: { places: [place("PHI", "-3.5", "in", "Sun 8:20"), miss("Pick 2"), { label: "Survivor", note: "No pick", state: "missed", survivor: true }], status: null, action: "PICK", stub: "1 LEFT" },
    },
    {
      id: "round", name: "Playoff round", about: "A pick for every game, one column a game, and the race to catch the leader.",
      view: playoff({ kicked: 1, race: oneRace, mine: { picks: ["KC", "PHI", "DET"], survivor: null }, rows: [
        { ...you(1, [slat("KC", "-2.5", "W"), slat("PHI", "-3.5"), slat("DET", "-6.5"), null], { kind: "none" }), back: 1 },
        { ...other("d", "Dana", 2, [slat("KC", "-2.5", "W"), slat("DAL", "+3.5"), slat(null, null, null, true), slat(null, null, null, true)], { kind: "none" }), back: 0 },
        { ...other("e", "Earl", 1, [slat("BUF", "+2.5", "L"), slat("PHI", "-3.5"), slat(null, null, null, true), slat(null, null, null, true)], { kind: "none" }), back: 1 },
      ] }),
      ticket: { places: [place("KC", "-2.5", "won", "Won 27–24"), place("PHI", "-3.5", "in", "Live"), place("DET", "-6.5", "in", "Sun 1:00"), open("MIA @ NYJ")], status: null, action: "PICK", stub: "1 LEFT" },
    },
    {
      id: "out", name: "Out of the race", about: "You can no longer catch the leader: your score stands, the row dims, nothing left to pick.",
      view: playoff({ kicked: 2, race: { leaders: ["Dana"], leaderWins: 3, toPlay: 2, you: { back: null, out: true, forfeited: false, forfeitAvailable: false } }, mine: { picks: ["BUF", "DAL", "GB"], survivor: null }, rows: [
        { ...you(0, [slat("BUF", "+2.5", "L"), slat("DAL", "+3.5"), slat("GB", "+6.5"), null], { kind: "none" }), out: true, back: null },
        { ...other("d", "Dana", 3, [slat("KC", "-2.5", "W"), slat("PHI", "-3.5"), slat(null, null, null, true), slat(null, null, null, true)], { kind: "none" }), back: 0 },
      ] }),
      ticket: { places: [place("BUF", "+2.5", "lost", "Lost 24–27"), place("DAL", "+3.5", "in", "Live"), place("GB", "+6.5", "in", "Sun 1:00"), miss("MIA @ NYJ")], status: { label: "RACE OVER", text: "Score stands" }, action: "VIEW", stub: "" },
    },
    {
      id: "forfeit", name: "Forfeited", about: "You stepped out of the round: your score stands, the row struck through.",
      view: playoff({ kicked: 1, race: { leaders: ["Dana"], leaderWins: 2, toPlay: 3, you: { back: null, out: false, forfeited: true, forfeitAvailable: false } }, mine: { picks: ["KC"], survivor: null }, rows: [
        { ...you(1, [slat("KC", "-2.5", "W"), null, null, null], { kind: "none" }), forfeited: true, back: null },
        { ...other("d", "Dana", 2, [slat("KC", "-2.5", "W"), slat("DAL", "+3.5"), slat(null, null, null, true), slat(null, null, null, true)], { kind: "none" }), back: 0 },
      ] }),
      ticket: { places: [place("KC", "-2.5", "won", "Won 27–24"), miss("DAL @ PHI"), miss("GB @ DET"), miss("MIA @ NYJ")], status: { label: "FORFEITED", text: "Score stands" }, action: "VIEW", stub: "" },
    },
  ];
  return states;
}
